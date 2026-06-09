import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createPerson,
  createItem,
  getAllItems,
  getItemById,
  getPersonById,
  getPendingSyncItems,
  updateItemStatus,
  markItemSynced,
  normalizeMobile,
  Person,
  Item,
  ItemStatus,
} from './database.js';
import { WsClientManager, ConnectionStatus } from './ws-client.js';

// ---------------------------------------------------------------------------
// Router factory — accepts the WsClientManager ref and dept name
// ---------------------------------------------------------------------------
/**
 * Allowed state transitions for items.
 * Each entry lists the statuses the current status can transition to.
 * Identity transitions (same → same) are included for idempotency:
 * PATCHing the current status is a no-op, not an error.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  'lost': ['lost', 'found'],
  'found': ['found', 'claimed'],
  'claimed': ['claimed'],   // terminal state — only identity no-op allowed
};

export function createApiRouter(
  wsManager: WsClientManager,
  deptName: string
): Router {
  const router = Router();

  // --- Health / Status ---

  router.get('/status', (_req: Request, res: Response) => {
    const status: ConnectionStatus = wsManager.connectionStatus;
    res.json({
      deptName,
      connected: status === 'connected',
      status,
      nodeCount: wsManager.nodeList.length,
      nodes: wsManager.nodeList,
    });
  });

  // --- Persons ---

  router.post('/persons', async (req: Request, res: Response) => {
    try {
      const { full_name, mobile, id_type, id_number } = req.body;

      if (!full_name || !mobile) {
        res.status(400).json({ error: 'full_name and mobile are required' });
        return;
      }

      const person: Person = {
        id: uuidv4(),
        full_name,
        mobile: normalizeMobile(mobile),
        id_type: id_type || undefined,
        id_number: id_number || undefined,
      };

      await createPerson(person);
      res.status(201).json(person);
    } catch (err) {
      console.error('[API] Error creating person:', err);
      res.status(500).json({ error: 'Failed to create person' });
    }
  });

  router.get('/persons/:id', async (req: Request, res: Response) => {
    try {
      const person = await getPersonById(req.params.id);
      if (!person) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }
      res.json(person);
    } catch (err) {
      console.error('[API] Error fetching person:', err);
      res.status(500).json({ error: 'Failed to fetch person' });
    }
  });

  // --- Items ---

  router.get('/items', async (_req: Request, res: Response) => {
    try {
      const items = await getAllItems();
      res.json(items);
    } catch (err) {
      console.error('[API] Error fetching items:', err);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  });

  router.get('/items/:id', async (req: Request, res: Response) => {
    try {
      const item = await getItemById(req.params.id);
      if (!item) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }
      // If item has a surrendered_by, attach person details
      let surrenderedByPerson: Person | undefined;
      if (item.surrendered_by) {
        surrenderedByPerson = await getPersonById(item.surrendered_by);
      }
      let claimedByPerson: Person | undefined;
      if (item.claimed_by) {
        claimedByPerson = await getPersonById(item.claimed_by);
      }
      res.json({ ...item, surrenderedByPerson, claimedByPerson });
    } catch (err) {
      console.error('[API] Error fetching item:', err);
      res.status(500).json({ error: 'Failed to fetch item' });
    }
  });

  router.post('/items', async (req: Request, res: Response) => {
    try {
      const {
        item_name, description, category, status,
        surrendered_by,
      } = req.body;

      if (!item_name || !status) {
        res.status(400).json({ error: 'item_name and status are required' });
        return;
      }

      if (!['lost', 'found'].includes(status)) {
        res.status(400).json({ error: 'status must be "lost" or "found"' });
        return;
      }

      if (surrendered_by) {
        const surrenderer = await getPersonById(surrendered_by);
        if (!surrenderer) {
          res.status(400).json({ error: 'Surrenderer person not found' });
          return;
        }
      }

      const isConnected = wsManager.connectionStatus === 'connected';

      const item: Item = {
        id: uuidv4(),
        item_name,
        description: description ?? null,
        category: category ?? null,
        department_origin: deptName,
        status: status as ItemStatus,
        surrendered_by: surrendered_by ?? null,
        synced: isConnected ? 1 : 0,    // 0 = offline, will sync later
      };

      await createItem(item);

      // If online, broadcast to hub immediately
      if (isConnected) {
        // Fetch full surrenderer person details
        let surrenderedByPerson: Person | null = null;
        if (item.surrendered_by) {
          surrenderedByPerson = await getPersonById(item.surrendered_by);
        }

        wsManager.send('ITEM_BROADCAST', {
          id: item.id,
          item_name: item.item_name,
          description: item.description,
          category: item.category,
          department_origin: item.department_origin,
          status: item.status,
          surrendered_by: surrenderedByPerson, // full person object or null
          created_at: item.created_at ?? new Date().toISOString(),
        });
      }

      res.status(201).json(item);
    } catch (err) {
      console.error('[API] Error creating item:', err);
      res.status(500).json({ error: 'Failed to create item' });
    }
  });

  // --- Status Update (e.g., claim item) ---

  router.patch('/items/:id/status', async (req: Request, res: Response) => {
    try {
      const { status, claimed_by, surrendered_by } = req.body;

      if (!status || !['lost', 'found', 'claimed'].includes(status)) {
        res.status(400).json({ error: 'status must be "lost", "found", or "claimed"' });
        return;
      }

      const item = await getItemById(req.params.id);
      if (!item) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }

      // --- Strict state machine validation ---
      const currentStatus = item.status;
      const allowedNext = VALID_TRANSITIONS[currentStatus] ?? [];

      if (!allowedNext.includes(status)) {
        const message =
          allowedNext.length === 0
            ? `Item is already in terminal state "${currentStatus}" — no further transitions are allowed.`
            : `Cannot transition item from "${currentStatus}" to "${status}". Allowed transition: "${currentStatus}" -> "${allowedNext.join(', ')}".`;
        res.status(400).json({ error: message });
        return;
      }

      if (status === 'claimed') {
        if (!claimed_by) {
          res.status(400).json({ error: 'claimed_by is required when status is "claimed"' });
          return;
        }
        const claimant = await getPersonById(claimed_by);
        if (!claimant) {
          res.status(400).json({ error: 'Claimant person not found' });
          return;
        }
      }

      // Validate surrendered_by person if provided (when transitioning to found)
      if (surrendered_by) {
        const surrendererPerson = await getPersonById(surrendered_by);
        if (!surrendererPerson) {
          res.status(400).json({ error: 'Surrenderer person not found' });
          return;
        }
      }

      await updateItemStatus(req.params.id, status as ItemStatus, claimed_by, surrendered_by);

      // Broadcast status update if online
      if (wsManager.connectionStatus === 'connected') {
        // Fetch full person details for broadcast
        let claimedByPerson: Person | null = null;
        if (claimed_by) {
          claimedByPerson = (await getPersonById(claimed_by)) ?? null;
        }

        let surrenderedByPerson: Person | null = null;
        if (surrendered_by) {
          surrenderedByPerson = (await getPersonById(surrendered_by)) ?? null;
        }

        wsManager.send('STATUS_UPDATE', {
          id: req.params.id,
          status,
          claimed_by: claimedByPerson, // full person object or null
          surrendered_by: surrenderedByPerson, // full person object or null
          updated_at: new Date().toISOString(),
        });
        await markItemSynced(req.params.id);
      }

      const updated = await getItemById(req.params.id);
      res.json(updated);
    } catch (err) {
      console.error('[API] Error updating item status:', err);
      res.status(500).json({ error: 'Failed to update item status' });
    }
  });

  // --- Sync Queue ---

  router.get('/pending', async (_req: Request, res: Response) => {
    try {
      const items = await getPendingSyncItems();
      res.json({ count: items.length, items });
    } catch (err) {
      console.error('[API] Error fetching pending sync items:', err);
      res.status(500).json({ error: 'Failed to fetch pending sync items' });
    }
  });

  return router;
}
