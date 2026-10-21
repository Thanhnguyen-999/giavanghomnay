import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { IconAlert, IconX } from './icons.tsx';

/* ===================== Types ===================== */

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /// Hành động phá hủy → nút đỏ.
  danger?: boolean;
}

interface UiContext {
  toast: (message: string, tone?: ToastTone) => void;
  /// Mở hộp xác nhận; resolve true nếu người dùng đồng ý.
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<UiContext | null>(null);

export function useUi(): UiContext {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUi phải nằm trong <UiProvider>');
  return c;
}

/* ===================== Provider ===================== */

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  );

  function close(ok: boolean) {
    dialog?.resolve(ok);
    setDialog(null);
  }

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      {dialog && <ConfirmDialog opts={dialog} onClose={close} />}
    </Ctx.Provider>
  );
}

/* ===================== Toast ===================== */

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`} role="status">
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Đóng">
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ===================== Confirm dialog ===================== */

function ConfirmDialog({
  opts,
  onClose,
}: {
  opts: ConfirmOptions;
  onClose: (ok: boolean) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={() => onClose(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          {opts.danger && (
            <span className="modal-icon danger" aria-hidden>
              <IconAlert size={20} />
            </span>
          )}
          <h3 id="confirm-title">{opts.title}</h3>
        </div>
        {opts.message && <div className="modal-body">{opts.message}</div>}
        <div className="modal-foot">
          <button className="btn ghost" onClick={() => onClose(false)}>
            {opts.cancelLabel ?? 'Hủy'}
          </button>
          <button
            ref={confirmRef}
            className={`btn ${opts.danger ? 'danger' : 'primary'}`}
            onClick={() => onClose(true)}
          >
            {opts.confirmLabel ?? 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
