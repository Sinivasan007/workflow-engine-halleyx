import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000' });

// Workflows
export const getWorkflows = (params) => API.get('/workflows', { params });
export const getWorkflow = (id) => API.get(`/workflows/${id}`);
export const createWorkflow = (data) => API.post('/workflows', data);
export const updateWorkflow = (id, data) => API.put(`/workflows/${id}`, data);
export const deleteWorkflow = (id) => API.delete(`/workflows/${id}`);

// Steps
export const createStep = (workflowId, data) => 
  API.post(`/workflows/${workflowId}/steps`, data);
export const updateStep = (id, data) => API.put(`/steps/${id}`, data);
export const deleteStep = (id) => API.delete(`/steps/${id}`);

// Rules
export const getRules = (stepId) => API.get(`/steps/${stepId}/rules`);
export const createRule = (stepId, data) => API.post(`/steps/${stepId}/rules`, data);
export const updateRule = (id, data) => API.put(`/rules/${id}`, data);
export const deleteRule = (id) => API.delete(`/rules/${id}`);

// Executions
export const executeWorkflow = (id, data) => 
  API.post(`/workflows/${id}/execute`, data);
export const getExecutions = (params) => API.get('/executions', { params });
export const getExecution = (id) => API.get(`/executions/${id}`);
export const approveExecution = (id, data) => API.post(`/executions/${id}/approve`, data);
export const cancelExecution = (id) => API.post(`/executions/${id}/cancel`);
export const retryExecution = (id) => API.post(`/executions/${id}/retry`);

export default API;
