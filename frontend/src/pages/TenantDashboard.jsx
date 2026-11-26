import { useState, useEffect, useRef } from 'react';
import {
  getProperties,
  getTenants,
  updateTenant,
  getPayments,
  createPayment,
  getTickets,
  createTicket,
} from '../api/rentalsApi';
import '../styles/tenant.css';

const MIN_PAYMENT = 10;
const NOTICE_DAYS = 30;
const DUE_DAY = 5;

export default function TenantDashboard() {
  const [activeTab, setActiveTab] = useState('rent'); // rent, repairs, moveout

  // Backend state (defaults to Amina Wanjiru in Unit B4, matching tenant.js)
  const [propertyName, setPropertyName] = useState('Mwangaza Court');
  const [tenant, setTenant] = useState(null);
  const [payments, setPayments] = useState([]);
  const [tickets, setTickets] = useState([]);

  // Payment form state
  const [amountInput, setAmountInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [amountError, setAmountError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [simFail, setSimFail] = useState(false);

  // M-Pesa STK Push Modal state
  const [payStep, setPayStep] = useState(null); // null, 'sending', 'pin', 'success', 'failed'
  const [payResult, setPayResult] = useState(null);
  const flowRef = useRef(0);

  // Repairs form state
  const [category, setCategory] = useState('Plumbing');
  const [description, setDescription] = useState('');
  const [descError, setDescError] = useState('');
  const [photoData, setPhotoData] = useState(null);
  const fileInputRef = useRef(null);

  // Notice modal state
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [vacateDate, setVacateDate] = useState('');
  const [vacateError, setVacateError] = useState('');

  // Toasts
  const [toasts, setToasts] = useState([]);

  const toast = (msg, isError = false) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, isError }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  };

  useEffect(() => {
    loadTenantData();
  }, []);

  const loadTenantData = async () => {
    try {
      const [propRes, tenRes, payRes, tickRes] = await Promise.all([
        getProperties(),
        getTenants(),
        getPayments(),
        getTickets(),
      ]);
      if (propRes.data.length > 0) setPropertyName(propRes.data[0].name);

      // Find Amina Wanjiru (Unit B4) or fallback to first active tenant
      const me =
        tenRes.data.find((t) => t.unit_code === 'B4' && t.status === 'active') ||
        tenRes.data.find((t) => t.status === 'active');

      if (me) {
        setTenant(me);
        const bal = Number(me.balance);
        setAmountInput(bal > 0 ? bal.toLocaleString('en-KE') : '');
        if (!phoneInput) {
          setPhoneInput(prettyPhone(normalisePhone(me.phone) || '254712345678'));
        }
        setPayments(payRes.data.filter((p) => p.tenant === me.id));
        setTickets(tickRes.data.filter((t) => t.tenant === me.id));
      }
    } catch (err) {
      toast('Could not connect to Django server.', true);
    }
  };

  /* ---------- Formatting & Validation Helpers (from tenant.js) ---------- */
  const num = (n) => Number(n).toLocaleString('en-KE');
  const ksh = (n) => `Ksh ${num(n)}`;
  const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
    new Date(iso).toLocaleDateString('en-KE', opts);

  const readAmount = () => Number(String(amountInput).replace(/\D/g, '')) || 0;

  const normalisePhone = (raw) => {
    const digits = String(raw).replace(/[\s\-()]/g, '');
    const m = digits.match(/^(?:\+?254|0)?([71]\d{8})$/);
    return m ? '254' + m[1] : null;
  };

  const prettyPhone = (msisdn) =>
    '0' + msisdn.slice(3).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

  const getAmountValidationError = (val, bal) => {
    if (!val) return 'Enter how much you want to pay.';
    if (val < MIN_PAYMENT) return `The smallest payment is ${ksh(MIN_PAYMENT)}.`;
    if (val > bal) return `You owe ${ksh(bal)}. Enter that amount or less.`;
    return '';
  };

  const genReceipt = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let s = 'Q';
    for (let i = 0; i < 9; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  if (!tenant) {
    return <div className="app"><p className="empty">Loading Tenant Portal...</p></div>;
  }

  const balance = Number(tenant.balance);
  const rent = Number(tenant.rent);
  const currentAmount = readAmount();
  const liveAmtErr = getAmountValidationError(currentAmount, balance);
  const paidThisMonth = balance <= rent ? Math.max(0, rent - balance) : 0;
  const meterPct = rent ? Math.min(100, Math.round((paidThisMonth / rent) * 100)) : 0;

  // Quick chips
  const chips = [{ label: 'Full balance', value: balance }];
  const half = Math.round(balance / 2);
  if (half >= MIN_PAYMENT && half < balance) chips.push({ label: 'Half', value: half });
  if (balance > 5000) chips.push({ label: ksh(5000), value: 5000 });

  // Due line calculation
  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), DUE_DAY);
  const diffDays = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) - dueDate) / 864e5
  );

  /* ---------- M-Pesa STK Push Flow ---------- */
  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const aErr = getAmountValidationError(currentAmount, balance);
    const msisdn = normalisePhone(phoneInput);

    setAmountError(aErr);
    setPhoneError(msisdn ? '' : 'Enter a valid Safaricom number, like 0712 345 678.');
    if (aErr || !msisdn) return;

    const id = ++flowRef.current;
    setPayResult({ msisdn, amount: currentAmount });
    setPayStep('sending');

    await new Promise((r) => setTimeout(r, 1500));
    if (id !== flowRef.current) return;
    setPayStep('pin');

    await new Promise((r) => setTimeout(r, 2500));
    if (id !== flowRef.current) return;

    if (simFail) {
      setPayStep('failed');
      return;
    }

    const receipt = genReceipt();
    const newBalance = Math.max(0, balance - currentAmount);

    try {
      await updateTenant(tenant.id, { balance: newBalance });
      await createPayment({
        tenant: tenant.id,
        amount: currentAmount,
        receipt,
        method: 'M-Pesa',
      });
      setPayResult({ msisdn, amount: currentAmount, receipt, left: newBalance });
      setPayStep('success');
      await loadTenantData();
    } catch (err) {
      setPayStep('failed');
    }
  };

  /* ---------- Photo Upload & Maintenance Submit ---------- */
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return setPhotoData(null);
    const reader = new FileReader();
    reader.onload = () => setPhotoData(reader.result);
    reader.readAsDataURL(file);
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      setDescError('Add a few more words so your landlord knows what to fix.');
      return;
    }
    setDescError('');
    try {
      await createTicket({
        tenant: tenant.id,
        unit: tenant.unit,
        category,
        description: description.trim(),
        photo: photoData,
        status: 'Open',
      });
      setDescription('');
      setPhotoData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast('Sent. Your landlord can see this now.');
      loadTenantData();
    } catch (err) {
      toast('Could not submit request.', true);
    }
  };

  /* ---------- Move-Out Notice Flow ---------- */
  const minVacateISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + NOTICE_DAYS);
    return d.toISOString().slice(0, 10);
  };

  const openNoticeModal = () => {
    setVacateDate(minVacateISO());
    setVacateError('');
    setNoticeOpen(true);
  };

  const handleNoticeSubmit = async (e) => {
    e.preventDefault();
    if (!vacateDate || vacateDate < minVacateISO()) {
      setVacateError(`Pick a date at least ${NOTICE_DAYS} days from today.`);
      return;
    }
    await updateTenant(tenant.id, {
      notice_vacate_date: vacateDate,
      notice_submitted_at: new Date().toISOString(),
    });
    setNoticeOpen(false);
    toast('Notice sent to your landlord.');
    loadTenantData();
  };

  const handleWithdrawNotice = async () => {
    await updateTenant(tenant.id, {
      notice_vacate_date: null,
      notice_submitted_at: null,
    });
    toast('Notice withdrawn. Your tenancy continues.');
    loadTenantData();
  };

  return (
    <div className="app">
      {/* Top Bar */}
      <header className="topbar">
        <div>
          <h1>Hello, {tenant.name.split(' ')[0]}</h1>
          <p className="where">{propertyName}</p>
        </div>
        <span className="pill pill-ok">Unit {tenant.unit_code}</span>
      </header>

      {/* ================= VIEW 1: RENT ================= */}
      {activeTab === 'rent' && (
        <main>
          <section className={`balance ${balance <= 0 ? 'is-clear' : ''}`}>
            <p className="balance-label">Balance due</p>
            <div className="balance-figure">
              <span className="cur">Ksh</span>
              <span className="num">{num(balance)}</span>
            </div>
            <p className="balance-due">
              {balance <= 0 ? (
                <><strong>Nothing due.</strong> You are up to date.</>
              ) : diffDays > 0 ? (
                <>Rent was due {fmtDate(dueDate, { day: 'numeric', month: 'short' })}. <strong>{diffDays} days overdue.</strong></>
              ) : (
                <>Rent is due {fmtDate(dueDate, { day: 'numeric', month: 'short' })}.</>
              )}
            </p>

            <div className="meter">
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${meterPct}%` }}></div>
              </div>
              <p className="meter-text">
                {balance > rent
                  ? `Includes ${ksh(balance - rent)} carried over from earlier months`
                  : `${ksh(paidThisMonth)} of ${ksh(rent)} paid this month`}
              </p>
            </div>
          </section>

          <section className="card" style={{ marginTop: '1rem' }}>
            {balance <= 0 ? (
              <div className="paid-up">
                <div className="tick">✓</div>
                <h2 className="card-title">You are all paid up</h2>
                <p className="card-sub">Your next rent will appear here on the 1st.</p>
              </div>
            ) : (
              <>
                <h2 className="card-title">Pay via M-Pesa</h2>
                <p className="card-sub">Edit the amount if you are paying in instalments.</p>

                <form onSubmit={handlePaySubmit} style={{ marginTop: '1rem' }}>
                  <div className="field">
                    <label htmlFor="amount">Amount to pay</label>
                    <div className="amount-wrap">
                      <span className="prefix">Ksh</span>
                      <input
                        id="amount"
                        className="input amount-input"
                        type="text"
                        inputMode="numeric"
                        value={amountInput}
                        aria-invalid={Boolean(amountError)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                          setAmountInput(digits ? num(digits) : '');
                          setAmountError('');
                        }}
                      />
                    </div>
                    <div className="chips">
                      {chips.map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          className="chip"
                          aria-pressed={currentAmount === c.value}
                          onClick={() => {
                            setAmountInput(num(c.value));
                            setAmountError('');
                          }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    {amountError && <p className="error">{amountError}</p>}
                  </div>

                  <div className="after-pay">
                    {!liveAmtErr ? (
                      balance - currentAmount === 0 ? (
                        'This pays your balance in full.'
                      ) : (
                        <>After this payment, <strong>{ksh(balance - currentAmount)}</strong> will remain on your balance.</>
                      )
                    ) : (
                      'Choose an amount to see what will remain.'
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="phone">M-Pesa phone number</label>
                    <input
                      id="phone"
                      className="input"
                      type="tel"
                      value={phoneInput}
                      aria-invalid={Boolean(phoneError)}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setPhoneError('');
                      }}
                    />
                    {phoneError && <p className="error">{phoneError}</p>}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    style={{ marginTop: '1rem' }}
                    disabled={Boolean(liveAmtErr)}
                  >
                    {!liveAmtErr ? `Pay ${ksh(currentAmount)} via M-Pesa` : 'Pay via M-Pesa'}
                  </button>
                </form>
              </>
            )}
          </section>

          {/* Payment History */}
          <section className="card">
            <h2 className="card-title">Recent payments</h2>
            <ul className="rows">
              {payments.length === 0 ? (
                <li className="empty">No payments yet. Your M-Pesa payments will show up here.</li>
              ) : (
                payments.map((p) => (
                  <li key={p.id} className="row">
                    <div className="row-main">
                      <p className="row-title">{p.method} payment</p>
                      <p className="row-meta">
                        {fmtDate(p.date, { day: 'numeric', month: 'short' })} &middot; {p.receipt}
                      </p>
                    </div>
                    <span className="row-amount">{ksh(p.amount)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <details className="demo">
            <summary>Demo controls</summary>
            <div className="demo-body">
              <label>
                <input
                  type="checkbox"
                  checked={simFail}
                  onChange={(e) => setSimFail(e.target.checked)}
                />
                Simulate declined M-Pesa PIN
              </label>
            </div>
          </details>
        </main>
      )}

      {/* ================= VIEW 2: REPAIRS ================= */}
      {activeTab === 'repairs' && (
        <main>
          <section className="card">
            <h2 className="card-title">Report a repair</h2>
            <p className="card-sub">Goes straight to your landlord.</p>

            <form onSubmit={handleTicketSubmit} style={{ marginTop: '1rem' }}>
              <div className="field">
                <label htmlFor="category">What needs fixing?</label>
                <select
                  id="category"
                  className="select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>Plumbing</option>
                  <option>Electrical</option>
                  <option>Security and locks</option>
                  <option>Doors and windows</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="desc">Describe the problem</label>
                <textarea
                  id="desc"
                  className="textarea"
                  placeholder="Tell your landlord where it is and what is happening..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                {descError && <p className="error">{descError}</p>}
              </div>

              <div className="field">
                <span className="label">Photo (optional)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handlePhotoChange}
                />
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoData ? 'Change photo' : 'Attach a photo'}
                </button>
                {photoData && (
                  <div className="photo-preview">
                    <img src={photoData} alt="Preview" />
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={() => setPhotoData(null)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1rem' }}>
                Send report
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="card-title">Your requests</h2>
            <ul className="rows">
              {tickets.length === 0 ? (
                <li className="empty">No requests yet. Anything you report will be listed here.</li>
              ) : (
                tickets.map((t) => (
                  <li key={t.id} className="row">
                    {t.photo ? (
                      <img className="thumb" src={t.photo} alt={t.category} />
                    ) : (
                      <div className="thumb thumb-empty">&ndash;</div>
                    )}
                    <div className="row-main">
                      <p className="row-title">{t.category}</p>
                      <p className="clamp">{t.description}</p>
                      <p className="row-meta">{fmtDate(t.created_at, { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <span className={`pill ${t.status === 'Resolved' ? 'pill-ok' : t.status === 'In progress' ? 'pill-warn' : ''}`}>
                      {t.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </main>
      )}

      {/* ================= VIEW 3: MOVE OUT ================= */}
      {activeTab === 'moveout' && (
        <main>
          <section className="card">
            <h2 className="card-title">Notice to vacate</h2>
            <p className="card-sub">
              {tenant.notice_vacate_date
                ? 'Your notice has been sent to your landlord.'
                : `Planning to leave? Give at least ${NOTICE_DAYS} days' notice so your landlord can plan.`}
            </p>

            {tenant.notice_vacate_date ? (
              <>
                <div className="notice-status">
                  <strong>Moving out on {fmtDate(tenant.notice_vacate_date)}</strong>
                  Waiting for your landlord to confirm.
                  {balance > 0 && <><br />You still owe {ksh(balance)}, due before you leave.</>}
                </div>
                <button
                  type="button"
                  className="btn btn-quiet btn-block"
                  style={{ marginTop: '1rem' }}
                  onClick={handleWithdrawNotice}
                >
                  Withdraw notice
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ marginTop: '1rem' }}
                onClick={openNoticeModal}
              >
                Give notice to vacate
              </button>
            )}
          </section>
        </main>
      )}

      {/* Bottom Navigation */}
      <nav className="nav" aria-label="Primary">
        <div className="nav-inner">
          <button
            type="button"
            aria-current={activeTab === 'rent' ? 'page' : undefined}
            onClick={() => setActiveTab('rent')}
          >
            Rent
          </button>
          <button
            type="button"
            aria-current={activeTab === 'repairs' ? 'page' : undefined}
            onClick={() => setActiveTab('repairs')}
          >
            Repairs
          </button>
          <button
            type="button"
            aria-current={activeTab === 'moveout' ? 'page' : undefined}
            onClick={() => setActiveTab('moveout')}
          >
            Move out
          </button>
        </div>
      </nav>

      {/* M-Pesa STK Push Dialog */}
      {payStep && (
        <dialog open className="sheet">
          {payStep === 'sending' && (
            <>
              <div className="pay-state">
                <div className="spinner"></div>
                <h2>Sending payment request</h2>
                <p>Contacting M-Pesa for {prettyPhone(payResult.msisdn)}</p>
              </div>
              <div className="sheet-actions">
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    flowRef.current++;
                    setPayStep(null);
                    toast('Payment cancelled. Nothing was charged.');
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {payStep === 'pin' && (
            <>
              <div className="pay-state">
                <div className="spinner"></div>
                <h2>Check your phone</h2>
                <p>Enter your M-Pesa PIN to pay <strong>{ksh(payResult.amount)}</strong>.</p>
              </div>
              <div className="sheet-actions">
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    flowRef.current++;
                    setPayStep(null);
                    toast('Payment cancelled. Nothing was charged.');
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {payStep === 'success' && (
            <>
              <div className="pay-state">
                <div className="tick">✓</div>
                <h2>Payment received</h2>
                <p>{payResult.left === 0 ? 'Your balance is now clear.' : `You still owe ${ksh(payResult.left)}.`}</p>
              </div>
              <dl className="receipt">
                <div><dt>Amount paid</dt><dd>{ksh(payResult.amount)}</dd></div>
                <div><dt>M-Pesa receipt</dt><dd>{payResult.receipt}</dd></div>
                <div><dt>Remaining balance</dt><dd>{ksh(payResult.left)}</dd></div>
              </dl>
              <div className="sheet-actions">
                <button type="button" className="btn btn-primary" onClick={() => setPayStep(null)}>
                  Done
                </button>
              </div>
            </>
          )}

          {payStep === 'failed' && (
            <>
              <div className="pay-state">
                <div className="tick bad">✕</div>
                <h2>Payment not completed</h2>
                <p>M-Pesa declined the request. You were not charged.</p>
              </div>
              <div className="sheet-actions">
                <button type="button" className="btn btn-quiet" onClick={() => setPayStep(null)}>
                  Close
                </button>
              </div>
            </>
          )}
        </dialog>
      )}

      {/* Move Out Dialog */}
      {noticeOpen && (
        <dialog open className="sheet">
          <h2>When do you plan to move out?</h2>
          <p className="hint" style={{ marginTop: '.4rem' }}>
            Earliest date is {fmtDate(minVacateISO())} ({NOTICE_DAYS} days from today).
          </p>
          <form onSubmit={handleNoticeSubmit} style={{ marginTop: '1rem' }}>
            <div className="field">
              <label htmlFor="vacateDate">Move-out date</label>
              <input
                id="vacateDate"
                type="date"
                className="input"
                min={minVacateISO()}
                value={vacateDate}
                onChange={(e) => setVacateDate(e.target.value)}
              />
              {vacateError && <p className="error">{vacateError}</p>}
            </div>
            <div className="sheet-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setNoticeOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Send notice
              </button>
            </div>
          </form>
        </dialog>
      )}

      {/* Toasts */}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.isError ? 'is-error' : ''}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}