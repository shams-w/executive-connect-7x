import {api} from './api';
/** Downloads an authenticated API file response (plain links can't send the access token). */
export async function downloadFile(path:string,filename:string){const r=await api.get(path,{responseType:'blob'});const url=URL.createObjectURL(r.data);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
