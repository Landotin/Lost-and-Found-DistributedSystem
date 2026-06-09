import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { Loader2, CheckCircle2, AlertCircle, WifiOff, X } from 'lucide-react';
import { validateMobile, validateRequired } from '../utils/validation';
import { resizeImage } from '../utils/image';
import type { Item, CreatePersonPayload, CreateItemPayload } from '../types';
import { createPerson, createItem, fetchMatchingItems } from '../hooks/useApi';

interface LogItemFormProps {
  onItemCreated?: (item: Item) => void;
  onNavigate?: (tab: 'lost-items' | 'claim', itemId?: string) => void;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error' | 'offline';

export default function LogItemForm({ onItemCreated, onNavigate }: LogItemFormProps) {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'lost' | 'found'>('lost');
  const [description, setDescription] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastCreatedPersonId, setLastCreatedPersonId] = useState<string | null>(null);

  // Image upload state
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadingRef = useRef(false);

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5MB');
      return;
    }

    setImageError(null);
    imageUploadingRef.current = true;

    try {
      const dataUrl = await resizeImage(file);
      setImageData(dataUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      imageUploadingRef.current = false;
    }
  };

  const handleRemoveImage = () => {
    setImageData(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Smart matching state
  const [matches, setMatches] = useState<Item[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [dismissedMatch, setDismissedMatch] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout>>(null);

  const resetForm = () => {
    setItemName('');
    setCategory('');
    setStatus('lost');
    setDescription('');
    setFullName('');
    setMobile('');
    setIdType('');
    setIdNumber('');
    setErrors({});
    setLastCreatedPersonId(null);
    setMatches([]);
    setDismissedMatch(false);
    setImageData(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ---------------------------------------------------------------------------
  // Smart Matching — debounced search for existing opposite-direction items
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Clear previous search timer
    if (searchRef.current) {
      clearTimeout(searchRef.current);
    }

    // Reset dismiss when search params change
    setDismissedMatch(false);

    // Require at least 2 chars for meaningful search
    if (itemName.trim().length < 2) {
      setMatches([]);
      return;
    }

    setMatchesLoading(true);

    searchRef.current = setTimeout(async () => {
      try {
        const result = await fetchMatchingItems(itemName.trim(), status);
        setMatches(result.matches);
      } catch {
        // Silently fail — matching is non-blocking
        setMatches([]);
      } finally {
        setMatchesLoading(false);
      }
    }, 300);

    return () => {
      if (searchRef.current) {
        clearTimeout(searchRef.current);
      }
    };
  }, [itemName, status]);

  const performSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!validateRequired(itemName)) {
      newErrors.itemName = 'Item name is required';
    }
    if (!validateRequired(category)) {
      newErrors.category = 'Category is required';
    }
    if (status === 'found') {
      if (!validateRequired(fullName)) {
        newErrors.fullName = 'Full name is required';
      }
      if (!validateMobile(mobile)) {
        newErrors.mobile = 'Mobile must be a valid number (+639XXXXXXXXX)';
      }
    } else if (status === 'lost') {
      if (!validateRequired(fullName)) {
        newErrors.fullName = 'Your name is required';
      }
      if (!validateMobile(mobile)) {
        newErrors.mobile = 'Mobile must be a valid number (+639XXXXXXXXX)';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setFormStatus('submitting');
    setErrorMessage('');

    try {
      let surrenderedBy: string | undefined;
      let reportedBy: string | undefined;

      if (status === 'found') {
        if (lastCreatedPersonId) {
          surrenderedBy = lastCreatedPersonId;
        } else {
          const personPayload: CreatePersonPayload = {
            full_name: fullName.trim(),
            mobile,
            id_type: idType || undefined,
            id_number: idNumber || undefined,
          };

          const person = await createPerson(personPayload);
          surrenderedBy = person.id;
          setLastCreatedPersonId(person.id);
        }
      } else if (status === 'lost') {
        if (lastCreatedPersonId) {
          reportedBy = lastCreatedPersonId;
        } else {
          const personPayload: CreatePersonPayload = {
            full_name: fullName.trim(),
            mobile,
            id_type: idType || undefined,
            id_number: idNumber || undefined,
          };

          const person = await createPerson(personPayload);
          reportedBy = person.id;
          setLastCreatedPersonId(person.id);
        }
      }

      const itemPayload: CreateItemPayload = {
        item_name: itemName.trim(),
        category,
        status,
        description: description.trim() || undefined,
        surrendered_by: surrenderedBy,
        reported_by: reportedBy,
        image_data: imageData ?? undefined,
      };

      const createdItem = await createItem(itemPayload);
      setFormStatus('success');
      onItemCreated?.(createdItem);

      setTimeout(() => {
        resetForm();
        setFormStatus('idle');
      }, 2000);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('HTTP ')) {
        setFormStatus('error');
        setErrorMessage(err.message);
      } else {
        setFormStatus('offline');
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    performSubmit();
  };

  const isSubmitting = formStatus === 'submitting';
  const showPersonSection = status === 'found' || status === 'lost';

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6 rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-lg">
      {/* Status alerts */}
      {formStatus === 'success' && (
        <div className="flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/50 p-4 text-green-200">
          <CheckCircle2 size={20} />
          <span>✓ Item logged successfully</span>
        </div>
      )}

      {formStatus === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-900/50 p-4 text-red-200">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      {formStatus === 'offline' && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-700 bg-yellow-900/50 p-4 text-yellow-200">
          <WifiOff size={20} />
          <span>Saved offline — will sync when connected</span>
        </div>
      )}

      {/* Smart Matching — suggestion banner */}
      {!dismissedMatch && matches.length > 0 && !matchesLoading && (
        <div
          className={`rounded-lg border p-4 ${
            status === 'found'
              ? 'border-yellow-600 bg-yellow-900/30'
              : 'border-blue-600 bg-blue-900/30'
          }`}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {status === 'found' ? (
                <>
                  <p className="text-sm font-medium text-yellow-200">
                    ⚠ This item was reported lost
                  </p>
                  <p className="mt-1 text-xs text-yellow-300/90">
                    &ldquo;{matches[0].item_name}&rdquo; was reported lost by{' '}
                    {matches[0].department_origin}. Consider marking the lost
                    record as found instead.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('lost-items', matches[0].id)}
                      className="rounded bg-yellow-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      Mark as Found
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedMatch(true)}
                      className="rounded border border-yellow-600 px-3 py-1 text-xs font-medium text-yellow-300 transition-colors hover:bg-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-blue-200">
                    ⚠ This item was already found
                  </p>
                  <p className="mt-1 text-xs text-blue-300/90">
                    &ldquo;{matches[0].item_name}&rdquo; was found by{' '}
                    {matches[0].department_origin}. Consider claiming it instead.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('claim', matches[0].id)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Claim Instead
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedMatch(true)}
                      className="rounded border border-blue-600 px-3 py-1 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Dismiss
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Item Details</h2>

        {/* Item Name */}
        <div>
          <label htmlFor="item-name" className="mb-1 block text-sm font-medium text-gray-300">
            Item Name <span className="text-red-400">*</span>
          </label>
          <input
            id="item-name"
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Enter item name"
          />
          {errors.itemName && (
            <p className="mt-1 text-sm text-red-400" role="alert">{errors.itemName}</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-300">
            Category <span className="text-red-400">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">Select category</option>
            <option value="Electronics">Electronics</option>
            <option value="Clothing">Clothing</option>
            <option value="Documents">Documents</option>
            <option value="Accessories">Accessories</option>
            <option value="Books">Books</option>
            <option value="Other">Other</option>
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-400" role="alert">{errors.category}</p>
          )}
        </div>

        {/* Status */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-gray-300">
            Status <span className="text-red-400">*</span>
          </legend>
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="status"
                value="lost"
                checked={status === 'lost'}
                onChange={() => setStatus('lost')}
                disabled={isSubmitting}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-gray-200">Lost</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="status"
                value="found"
                checked={status === 'found'}
                onChange={() => setStatus('found')}
                disabled={isSubmitting}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-gray-200">Found</span>
            </label>
          </div>
        </fieldset>

        {/* Description */}
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-300">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            placeholder="Optional description"
          />
        </div>

        {/* Item Photo (optional) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">Item Photo (optional)</label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              id="item-photo"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              disabled={isSubmitting || imageUploadingRef.current}
              className="block w-full text-sm text-gray-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gray-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-200 hover:file:bg-gray-600 disabled:opacity-50"
            />
            {imageData && (
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={isSubmitting}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-red-700 px-2 py-2 text-xs text-red-400 transition-colors hover:bg-red-900/30 disabled:opacity-50"
                aria-label="Remove image"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {imageError && (
            <p className="mt-1 text-sm text-red-400">{imageError}</p>
          )}

          {imageData && (
            <div className="mt-3">
              <img
                src={imageData}
                alt="Item photo preview"
                className="max-h-48 rounded-lg border border-gray-700 object-contain"
              />
            </div>
          )}
        </div>
      </div>

      {/* Contact Section (conditional) */}
      {showPersonSection && (
        <div className="space-y-4 border-t border-gray-700 pt-4">
          <h2 className="text-lg font-semibold text-gray-200">
            {status === 'found' ? 'Surrenderer Details' : 'Your Contact Information'}
          </h2>

          {/* Full Name */}
          <div>
            <label htmlFor="full-name" className="mb-1 block text-sm font-medium text-gray-300">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              id="full-name"
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

          {/* Mobile */}
          <div>
            <label htmlFor="mobile" className="mb-1 block text-sm font-medium text-gray-300">
              Mobile <span className="text-red-400">*</span>
            </label>
            <input
              id="mobile"
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              placeholder="+639XXXXXXXXX"
            />
            {errors.mobile && (
              <p className="mt-1 text-sm text-red-400" role="alert">{errors.mobile}</p>
            )}
          </div>

          {/* ID Type */}
          <div>
            <label htmlFor="id-type" className="mb-1 block text-sm font-medium text-gray-300">
              ID Type
            </label>
            <select
              id="id-type"
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
            <label htmlFor="id-number" className="mb-1 block text-sm font-medium text-gray-300">
              ID Number
            </label>
            <input
              id="id-number"
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              placeholder="Enter ID number"
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center gap-3">
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
            'Log Item'
          )}
        </button>

        {formStatus === 'error' && (
          <button
            type="button"
            onClick={performSubmit}
            className="rounded-lg border border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Retry
          </button>
        )}
      </div>
    </form>
  );
}
