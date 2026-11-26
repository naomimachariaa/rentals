import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/',
});

export const getProperties = () => api.get('properties/');
export const getUnits = () => api.get('units/');
export const createUnit = (data) => api.post('units/', data);
export const updateUnit = (id, data) => api.patch(`units/${id}/`, data);

export const getTenants = () => api.get('tenants/');
export const createTenant = (data) => api.post('tenants/', data);
export const updateTenant = (id, data) => api.patch(`tenants/${id}/`, data);

export const getApplications = () => api.get('applications/');
export const updateApplication = (id, data) => api.patch(`applications/${id}/`, data);

export const getPayments = () => api.get('payments/');
export const createPayment = (data) => api.post('payments/', data);

export const getTickets = () => api.get('tickets/');
export const createTicket = (data) => api.post('tickets/', data);