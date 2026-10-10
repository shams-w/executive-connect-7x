import type { Request,Response,NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export type TokenUser={id:string;username:string;role:'SUPER_ADMIN'|'HR_ADMIN'|'COMMUNICATIONS_ADMIN'|'VIEWER';mustChangePassword?:boolean};
declare global { namespace Express { interface Request { user?:TokenUser; rawBody?:Buffer } } }
export function requireAuth(req:Request,res:Response,next:NextFunction){const h=req.headers.authorization; if(!h?.startsWith('Bearer '))return res.status(401).json({error:'Unauthorized'}); try{req.user=jwt.verify(h.slice(7),env.JWT_SECRET) as TokenUser;}catch{return res.status(401).json({error:'Invalid or expired access token'});}
  // Until a temporary/default password is replaced, only the auth endpoints (me, change-password, logout) are usable.
  if(req.user.mustChangePassword&&!req.originalUrl.startsWith('/api/auth/'))return res.status(403).json({error:'You must change your password before continuing',code:'PASSWORD_CHANGE_REQUIRED'});
  next();}
export const allow=(...roles:TokenUser['role'][])=> (req:Request,res:Response,next:NextFunction)=>req.user&&roles.includes(req.user.role)?next():res.status(403).json({error:'Forbidden'});
