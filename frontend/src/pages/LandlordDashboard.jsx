import { useState, useEffect } from 'react';
import {
  getProperties,
  getUnits,
  getTenants,
  createTenant,
  updateTenant,
  getApplications,
  updateApplication,
  getPayments,
  getTickets,
} from '../api/rentalsApi';
import '../styles/landlord.css';

const SECTION_TITLES = {
  overview: 'Overview',
  approvals: 'Pending approvals',
  tenants: 'Tenants',
  maintenance: 'Maintenance log',
};

export default function LandlordDashboard() {
  const [activeSection, setActiveSection] = useState('overview');

  const [property, setProperty] = useState({ name: 'Mwangaza Court' });
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [applications, setApplications] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tickets, setTickets] = useState([]);

  const [tenantFilter, setTenantFilter] = useState('active');
  const [tenantSearch, setTenantSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState('All');

  const [confirmModal, setConfirmModal] = useState(null);
  const [photoModalUrl, setPhotoModalUrl] = useState(null);
  const [toasts, setToasts] = useState([]);

  const todayFormatted = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (text, isError = false) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, isError }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const loadAllData = async () => {
    try {
      const [propRes, unitRes, tenRes, appRes, payRes, tickRes] = await Promise.all([
        getProperties(),
        getUnits(),
        getTenants(),
        getApplications(),
        getPayments(),
        getTickets(),
      ]);
      if (propRes.data.length > 0) setProperty(propRes.data[0]);
      setUnits(unitRes.data);
      setTenants(tenRes.data);
      setApplications(appRes.data);
      setPayments(payRes.data);
      setTickets(tickRes.data);
    } catch (err) {
      showToast('Could not connect to Django backend.', true);
    }
  };

  const activeTenants = tenants.filter((t) => t.status === 'active');
  const pendingApps = applications.filter((a) => a.status === 'pending');
  const openTickets = tickets.filter((t) => t.status !== 'Resolved');

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const behindTenants = activeTenants.filter((t) => Number(t.balance) > 0);
  const totalArrears = behindTenants.reduce((sum, t) => sum + Number(t.balance || 0), 0);

  const blocks = [...new Set(units.map((u) => u.block))];

  const getActiveTenantForUnit = (unitId) =>
    activeTenants.find((t) => t.unit === unitId);

  const getInitials = (name) =>
    name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  // Approve QR Application
  const handleApproveApplication = async (app) => {
    const taken = activeTenants.some((t) => t.unit === app.unit);
    if (taken) {
      showToast('That unit already has a tenant.', true);
      return;
    }
    await updateApplication(app.id, {
      status: 'approved',
      decided_at: new Date().toISOString(),
    });
    await createTenant({
      unit: app.unit,
      name: app.name,
      phone: app.phone,
      id_number: app.id_number,
      rent: app.unit_rent,
      balance: app.unit_rent,
      status: 'active',
    });
    showToast(`${app.name.split(' ')[0]} approved for Unit ${app.unit_code}.`);
    loadAllData();
  };

  // Reject QR Application
  const handleRejectApplication = (app) => {
    setConfirmModal({
      title: `Reject ${app.name}?`,
      body: `They will not get a portal login for Unit ${app.unit_code}.`,
      confirmLabel: 'Reject application',
      danger: true,
      onConfirm: async () => {
        await updateApplication(app.id, {
          status: 'rejected',
          decided_at: new Date().toISOString(),
        });
        showToast(`${app.name}'s application was rejected.`);
        setConfirmModal(null);
        loadAllData();
      },
    });
  };

  // Deactivate Tenant (Move Out)
  const handleDeactivate = (tenant) => {
    setConfirmModal({
      title: `Deactivate ${tenant.name}?`,
      body: `Their portal login will be switched off and Unit ${tenant.unit_code} will be marked vacant.`,
      confirmLabel: 'Deactivate tenant',
      danger: true,
      onConfirm: async () => {
        await updateTenant(tenant.id, {
          status: 'inactive',
          moved_out_at: new Date().toISOString(),
        });
        showToast(`${tenant.name} deactivated. Unit ${tenant.unit_code} is now vacant.`);
        setConfirmModal(null);
        loadAllData();
      },
    });
  };

  const filteredTenants = tenants
    .filter((t) => t.status === tenantFilter)
    .filter((t) => {
      const q = tenantSearch.trim().toLowerCase();
      return (
        !q ||
        [t.name, t.unit_code, t.phone].some((v) =>
          String(v || '').toLowerCase().includes(q)
        )
      );
    })
    .sort((a, b) => String(a.unit_code || '').localeCompare(String(b.unit_code || '')));

  const filteredTickets =
    ticketFilter === 'All'
      ? tickets
      : tickets.filter((t) => t.status === ticketFilter);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <p className="brand-name">{property.name}</p>
          <p className="brand-role">Landlord</p>
        </div>
        <nav className="side-nav" aria-label="Sections">
          <button
            type="button"
            aria-current={activeSection === 'overview' ? 'page' : undefined}
            onClick={() => setActiveSection('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            aria-current={activeSection === 'approvals' ? 'page' : undefined}
            onClick={() => setActiveSection('approvals')}
          >
            Approvals
            {pendingApps.length > 0 && <span className="count">{pendingApps.length}</span>}
          </button>
          <button
            type="button"
            aria-current={activeSection === 'tenants' ? 'page' : undefined}
            onClick={() => setActiveSection('tenants')}
          >
            Tenants
          </button>
          <button
            type="button"
            aria-current={activeSection === 'maintenance' ? 'page' : undefined}
            onClick={() => setActiveSection('maintenance')}
          >
            Maintenance
            {openTickets.length > 0 && (
              <span className="count count-quiet">{openTickets.length}</span>
            )}
          </button>
        </nav>
        <div className="side-foot">
          <button className="btn btn-ghost" type="button" onClick={loadAllData}>
            Refresh data
          </button>
        </div>
      </aside>

      <div className="content">
        <header className="page-head">
          <h1 id="pageTitle">{SECTION_TITLES[activeSection]}</h1>
          <p className="today">{todayFormatted}</p>
        </header>

        <main>
          {/* ================= OVERVIEW ================= */}
          {activeSection === 'overview' && (
            <section aria-labelledby="pageTitle">
              <div className="metrics">
                <div className="card metric is-good">
                  <p className="metric-label">Collected this month</p>
                  <p className="metric-value">
                    <small>Ksh</small>
                    {totalCollected.toLocaleString('en-KE')}
                  </p>
                  <p className="metric-note">{payments.length} payments received</p>
                </div>

                <div className={`card metric ${totalArrears > 0 ? 'is-warn' : ''}`}>
                  <p className="metric-label">Total arrears</p>
                  <p className="metric-value">
                    <small>Ksh</small>
                    {totalArrears.toLocaleString('en-KE')}
                  </p>
                  <p className="metric-note">
                    {behindTenants.length
                      ? `Owed by ${behindTenants.length} tenant${behindTenants.length === 1 ? '' : 's'}`
                      : 'Everyone is paid up'}
                  </p>
                </div>

                <div className="card metric">
                  <p className="metric-label">Units occupied</p>
                  <p className="metric-value">
                    {activeTenants.length}
                    <small style={{ margin: '0 0 0 .35rem' }}>of {units.length}</small>
                  </p>
                  <p className="metric-note">
                    {units.length - activeTenants.length} units vacant
                  </p>
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <h2 className="card-title">Unit status</h2>
                  <p className="card-sub">
                    {activeTenants.length} occupied, {units.length - activeTenants.length} vacant. A dot marks a tenant who has given notice.
                  </p>
                  <div className="map" role="list">
                    {blocks.map((b) => (
                      <div key={b} className="block-row">
                        <span className="block-label">Block {b}</span>
                        {units
                          .filter((u) => u.block === b)
                          .map((u) => {
                            const t = getActiveTenantForUnit(u.id);
                            const cls = !t
                              ? 'tile-vacant'
                              : Number(t.balance) > 0
                              ? 'tile-arrears'
                              : 'tile-paid';
                            return (
                              <div
                                key={u.id}
                                role="listitem"
                                className={`tile ${cls}${t?.notice_vacate_date ? ' tile-notice' : ''}`}
                              >
                                <span className="tile-id">{u.unit_code}</span>
                                <span className="tile-who">
                                  {t ? t.name.split(' ')[0] : 'Vacant'}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                  <ul className="legend" aria-label="Legend">
                    <li><span className="swatch swatch-paid"></span>Occupied, paid up</li>
                    <li><span className="swatch swatch-arrears"></span>Occupied, owes rent</li>
                    <li><span className="swatch swatch-vacant"></span>Vacant</li>
                  </ul>
                </div>

                <div className="stack">
                  <div className="card">
                    <h2 className="card-title">Needs your attention</h2>
                    <ul className="rows">
                      {pendingApps.length > 0 && (
                        <li className="row">
                          <div className="row-main">
                            {pendingApps.length} application{pendingApps.length === 1 ? ' is' : 's are'} waiting for your decision
                          </div>
                          <button
                            className="link-btn"
                            type="button"
                            onClick={() => setActiveSection('approvals')}
                          >
                            Review
                          </button>
                        </li>
                      )}
                      {activeTenants
                        .filter((t) => t.notice_vacate_date)
                        .map((t) => (
                          <li key={`notice-${t.id}`} className="row">
                            <div className="row-main">
                              {t.name} (Unit {t.unit_code}) plans to leave on {t.notice_vacate_date}
                            </div>
                            <button
                              className="link-btn"
                              type="button"
                              onClick={() => setActiveSection('tenants')}
                            >
                              View
                            </button>
                          </li>
                        ))}
                      {openTickets.length > 0 && (
                        <li className="row">
                          <div className="row-main">
                            {openTickets.length} repair request{openTickets.length === 1 ? ' is' : 's are'} not resolved yet
                          </div>
                          <button
                            className="link-btn"
                            type="button"
                            onClick={() => setActiveSection('maintenance')}
                          >
                            View
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="card">
                    <h2 className="card-title">Recent payments</h2>
                    <p className="card-sub">Paid straight to you by M-Pesa.</p>
                    <ul className="rows">
                      {payments.slice(0, 6).map((p) => (
                        <li key={p.id} className="row">
                          <div className="row-main">
                            <p className="row-title">
                              {p.tenant_name}{' '}
                              <span className="cell-sub">Unit {p.unit_code}</span>
                            </p>
                            <p className="row-meta">{p.receipt}</p>
                          </div>
                          <span className="row-amount">
                            Ksh {Number(p.amount).toLocaleString('en-KE')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ================= APPROVALS ================= */}
          {activeSection === 'approvals' && (
            <section aria-labelledby="pageTitle">
              <p className="lede">
                People who signed up by scanning a unit's QR code. Nobody gets a unit or a portal login until you approve them.
              </p>
              <div className="apps">
                {pendingApps.length === 0 ? (
                  <div className="card">
                    <p className="card-title">No applications waiting</p>
                  </div>
                ) : (
                  pendingApps.map((a) => {
                    const taken = activeTenants.some((t) => t.unit === a.unit);
                    return (
                      <article key={a.id} className="card app-card">
                        <div className="app-head">
                          <span className="avatar">{getInitials(a.name)}</span>
                          <div>
                            <h2 className="card-title">{a.name}</h2>
                            <p className="card-sub">
                              Applying for Unit {a.unit_code}, Ksh {Number(a.unit_rent).toLocaleString('en-KE')} a month
                            </p>
                          </div>
                        </div>
                        <dl className="facts">
                          <dt>Phone</dt><dd>{a.phone}</dd>
                          <dt>National ID</dt><dd>{a.id_number}</dd>
                          <dt>Wants to move in</dt><dd>{a.move_in}</dd>
                          <dt>Signed up</dt><dd>by {a.source}</dd>
                        </dl>
                        {taken && (
                          <p className="taken">
                            Unit {a.unit_code} now has a tenant. You can only reject this application.
                          </p>
                        )}
                        <div className="app-actions">
                          <button
                            className="btn btn-outline-danger"
                            type="button"
                            onClick={() => handleRejectApplication(a)}
                          >
                            Reject
                          </button>
                          <button
                            className="btn btn-primary"
                            type="button"
                            disabled={taken}
                            onClick={() => handleApproveApplication(a)}
                          >
                            Approve
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* ================= TENANTS ================= */}
          {activeSection === 'tenants' && (
            <section aria-labelledby="pageTitle">
              <div className="toolbar">
                <div className="segmented" role="group" aria-label="Show">
                  <button
                    type="button"
                    aria-pressed={tenantFilter === 'active'}
                    onClick={() => setTenantFilter('active')}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    aria-pressed={tenantFilter === 'inactive'}
                    onClick={() => setTenantFilter('inactive')}
                  >
                    Moved out
                  </button>
                </div>
                <input
                  className="input search"
                  type="search"
                  placeholder="Search by name, unit or phone"
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                />
              </div>

              <div className="card table-card">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Unit</th>
                      <th className="num">Rent</th>
                      <th className="num">Balance</th>
                      <th>Notice</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <p className="cell-name">{t.name}</p>
                          <p className="cell-sub">{t.phone}</p>
                        </td>
                        <td>{t.unit_code}</td>
                        <td className="num">Ksh {Number(t.rent).toLocaleString('en-KE')}</td>
                        <td className={`num ${Number(t.balance) > 0 ? 'owes' : ''}`}>
                          {Number(t.balance) > 0 ? (
                            `Ksh ${Number(t.balance).toLocaleString('en-KE')}`
                          ) : (
                            <span className="pill pill-ok">Paid up</span>
                          )}
                        </td>
                        <td>
                          {t.notice_vacate_date ? (
                            <span className="pill pill-warn">Leaving {t.notice_vacate_date}</span>
                          ) : (
                            <span className="cell-sub">None</span>
                          )}
                        </td>
                        <td>
                          {tenantFilter === 'active' && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => handleDeactivate(t)}
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ================= MAINTENANCE ================= */}
          {activeSection === 'maintenance' && (
            <section aria-labelledby="pageTitle">
              <p className="lede">
                Everything your tenants have reported, with their photos. This is a read-only log.
              </p>
              <div className="chips">
                {['All', 'Open', 'In progress', 'Resolved'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="chip"
                    aria-pressed={ticketFilter === status}
                    onClick={() => setTicketFilter(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="tickets">
                {filteredTickets.map((t) => (
                  <article key={t.id} className="card ticket">
                    {t.photo ? (
                      <button
                        className="ticket-photo"
                        type="button"
                        onClick={() => setPhotoModalUrl(t.photo)}
                      >
                        <img src={t.photo} alt={t.category} />
                      </button>
                    ) : (
                      <div className="ticket-none">No photo added</div>
                    )}
                    <div className="ticket-body">
                      <div className="ticket-top">
                        <div>
                          <h2 className="card-title">{t.category}</h2>
                          <p className="row-meta">
                            Unit {t.unit_code}, {t.tenant_name}
                          </p>
                        </div>
                        <span
                          className={`pill ${
                            t.status === 'Resolved'
                              ? 'pill-ok'
                              : t.status === 'In progress'
                              ? 'pill-warn'
                              : ''
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className="ticket-desc">{t.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {confirmModal && (
        <dialog open className="sheet">
          <h2>{confirmModal.title}</h2>
          <div className="confirm-body">{confirmModal.body}</div>
          <div className="sheet-actions">
            <button className="btn btn-quiet" type="button" onClick={() => setConfirmModal(null)}>
              Cancel
            </button>
            <button
              className={`btn ${confirmModal.danger ? 'btn-danger' : 'btn-primary'}`}
              type="button"
              onClick={confirmModal.onConfirm}
            >
              {confirmModal.confirmLabel}
            </button>
          </div>
        </dialog>
      )}

      {photoModalUrl && (
        <dialog open className="sheet">
          <img src={photoModalUrl} alt="Tenant report" className="photo-large" />
          <div className="sheet-actions">
            <button className="btn btn-quiet" type="button" onClick={() => setPhotoModalUrl(null)}>
              Close
            </button>
          </div>
        </dialog>
      )}

      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.isError ? 'is-error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}