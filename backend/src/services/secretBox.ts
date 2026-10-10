import crypto from 'node:crypto';
import {env} from '../config/env.js';

// AES-256-GCM for secrets stored in the database. The key comes from SETTINGS_ENCRYPTION_KEY, or is derived from
// JWT_SECRET when that isn't set. Changing whichever is used makes saved secrets unreadable (they must be re-entered).
function key(){
  return env.SETTINGS_ENCRYPTION_KEY
    ?crypto.createHash('sha256').update(env.SETTINGS_ENCRYPTION_KEY).digest()
    :Buffer.from(crypto.hkdfSync('sha256',env.JWT_SECRET,'executive-connect','settings-encryption',32));
}
export function encryptSecret(plain:string):string{
  const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const data=Buffer.concat([c.update(plain,'utf8'),c.final()]);
  return ['v1',iv.toString('base64'),c.getAuthTag().toString('base64'),data.toString('base64')].join(':');
}
/** null when the value can't be decrypted (e.g. the key changed). */
export function decryptSecret(box:string):string|null{
  try{const [v,iv,tag,data]=box.split(':');if(v!=='v1')return null;const d=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64'));d.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([d.update(Buffer.from(data,'base64')),d.final()]).toString('utf8');}
  catch{return null;}
}
