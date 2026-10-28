import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { db } from '@mvs/database';
import { makeAuth } from '../apps/api/src/auth.js';
async function main(){if(await db.user.count())throw new Error('Owner exists. Bootstrap refuses to overwrite accounts.');const email=process.env.MVS_OWNER_EMAIL||'owner@mvs.local';const password=process.env.MVS_OWNER_PASSWORD||randomBytes(24).toString('base64url');await makeAuth(true).api.signUpEmail({body:{email,password,name:'Owner'}});await fs.mkdir('.runtime',{recursive:true});await fs.writeFile('.runtime/owner-credentials.txt',`Email: ${email}\nPassword: ${password}\n`,{flag:'wx'});console.log('Owner created. Credentials: .runtime/owner-credentials.txt. Keep this file private.');}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
