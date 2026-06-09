import { useState, useMemo, type FormEvent } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Search, ArrowLeft } from 'lucide-react';
import { validateMobile, validateRequired, formatMobileToE164 } from '../utils/validation';
import type { Item } from '../types';
import { createPerson, updateItemStatus } from '../hooks/useApi';

interface ProcessClaimProps {
  items: Item[] | null;
  preselectedItemId?: string | null;
  onClaimProcessed?: (itemId: string) => void;
}

type FormStatus = 'selecting' | 'filling' | 'submitting' | 'success' | 'error';

export default function ProcessClaim({ items, preselectedItemId, onClaimProcessed }: ProcessClaimProps) {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formStatus, setFormStatus] = useState<FormStatus>('selecting');
  const [errorMessage, setErrorMessage] = useState('');

  // Filter to only 'found' items and apply search
  const foundItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => item.status === 'found');
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!search) return foundItems;
    const q = search.toLowerCase();
    return foundItems.filter(
      (item) =>
        item.item_name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    );
  }, [foundItems, search]);

  // Handle preselected item
  const [preselectedHandled, setPreselectedHandled] = useState(false);
  if (preselectedItemId && !preselectedHandled && items) {
    const item = items.find((i) => i.id === preselectedItemId);
    if (item && item.status === 'found') {
      setSelectedItem(item);
      setFormStatus('filling');
    } else if (item) {
      // Item exists but not 'found' status
      setFormStatus('error');
      setErrorMessage('Selected item is not available for claiming.');
    } else {
      setFormStatus('error');
      setErrorMessage('Selected item not found.');
    }
    setPreselectedHandled(true);
  }

  // Loading state when items haven't loaded yet
  if (items === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-blue-500" />
          <span>Loading items...</span>
        </div>
      </div>
    );
  }

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setFormStatus('filling');
    setSearch('');
  };

  const handleBack = () => {
    setSelectedItem(null);
    setFormStatus('selecting');
    setFullName('');
    setMobile('');
    setIdType('');
    setIdNumber('');
    setErrors({});
    setErrorMessage('');
  };

  const performSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!validateRequired(fullName)) {
      newErrors.fullName = 'Full name is required';
    }
    if (!validateRequired(mobile)) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!validateMobile(mobile)) {
      newErrors.mobile = 'Mobile must be a valid number (+639XXXXXXXXX or 09XXXXXXXXX)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setFormStatus('submitting');
    setErrorMessage('');

    try {
      // Convert mobile to E.164 before sending to API
      const e164Mobile = formatMobileToE164(mobile);

      // Step 1: Create the claimant person record
      const person = await createPerson({
        full_name: fullName.trim(),
        mobile: e164Mobile,
        id_type: idType || undefined,
        id_number: idNumber || undefined,
      });

      // Step 2: Update the item status to 'claimed'
      await updateItemStatus(selectedItem!.id, 'claimed', person.id);

      setFormStatus('success');
      onClaimProcessed?.(selectedItem!.id);
    } catch (err) {
      setFormStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting claim');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    performSubmit();
  };

  const isSubmitting = formStatus === 'submitting';

  // Success state
  if (formStatus === 'success') {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-lg">
        <div className="flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/50 p-6 text-green-200">
          <CheckCircle2 size={24} />
          <div>
            <p className="font-semibold text-lg">Claim Successful</p>
            <p className="text-sm text-green-300 mt-1">
              {selectedItem?.item_name} has been marked as claimed.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleBack}
          className="w-full rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Claim Another Item
        </button>
      </div>
    );
  }

  // Error state (preselected item not found)
  if (formStatus === 'error' && !selectedItem) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-lg">
        <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-900/50 p-4 text-red-200">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (foundItems.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-lg">
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">📦 No found items available</p>
          <p className="text-sm mt-1">
            Only items with "found" status can be claimed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Item selection phase */}
      {formStatus === 'selecting' && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Select Item to Claim</h2>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search items by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search items"
            />
          </div>

          {/* Item list */}
          {filteredItems.length === 0 ? (
            <p className="text-center py-6 text-gray-500">
              No found items match your search.
            </p>
          ) : (
            <ul className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full px-3 py-3 text-left transition-colors hover:bg-gray-800/50 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-200">{item.item_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.category ?? '—'} &middot; {item.department_origin}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{item.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Claimant form phase */}
      {formStatus !== 'selecting' && formStatus !== 'success' && selectedItem && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-lg">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              aria-label="Back"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-200">Claim Item</h2>
              <p className="text-sm text-gray-400">Claiming: {selectedItem.item_name}</p>
            </div>
          </div>

          {/* Error alert */}
          {formStatus === 'error' && errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-900/50 p-4 mb-4 text-red-200">
              <AlertCircle size={20} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Claimant Details */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-300">Claimant Information</h3>

            {/* Full Name */}
            <div>
              <label htmlFor="claimant-full-name" className="mb-1 block text-sm font-medium text-gray-300">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                id="claimant-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                placeholder="Enter full name"
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-400" role="alert">{errors.fullName}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label htmlFor="claimant-mobile" className="mb-1 block text-sm font-medium text-gray-300">
                Mobile Number <span className="text-red-400">*</span>
              </label>
              <input
                id="claimant-mobile"
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
              />
              {errors.mobile && (
                <p className="mt-1 text-sm text-red-400" role="alert">{errors.mobile}</p>
              )}
            </div>

            {/* ID Type */}
            <div>
              <label htmlFor="claimant-id-type" className="mb-1 block text-sm font-medium text-gray-300">
                ID Type
              </label>
              <select
                id="claimant-id-type"
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select ID type</option>
                <option value="student_id">Student ID</option>
                <option value="employee_id">Employee ID</option>
                <option value="visitor">Visitor</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* ID Number */}
            <div>
              <label htmlFor="claimant-id-number" className="mb-1 block text-sm font-medium text-gray-300">
                ID Number
              </label>
              <input
                id="claimant-id-number"
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                placeholder="Enter ID number"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Submitting...
                </>
              ) : (
                'Submit Claim'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
