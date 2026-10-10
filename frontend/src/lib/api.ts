import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL??'http://localhost:8000/api',withCredentials:true});
let token:string|null=null;const listeners=new Set<(loggedIn:boolean)=>void>();
export function setToken(t:string|null){token=t;for(const fn of listeners)fn(Boolean(t));}
export function hasToken(){return Boolean(token)}
export function onAuthChange(fn:(loggedIn:boolean)=>void){listeners.add(fn);return()=>listeners.delete(fn)}
api.interceptors.request.use(c=>{if(token)c.headers.Authorization=`Bearer ${token}`;return c});
api.interceptors.response.use(r=>r,async e=>{if(e.response?.status===401&&!e.config.__retried&&!String(e.config.url).includes('/auth/')){e.config.__retried=true;try{const r=await api.post('/auth/refresh');setToken(r.data.accessToken);e.config.headers.Authorization=`Bearer ${r.data.accessToken}`;return api.request(e.config);}catch{setToken(null);}}return Promise.reject(e)});
