import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{const page=await browser.newPage();await page.goto('http://localhost:3000/fuse-warmup/export-native.html');await page.waitForFunction(()=>!!window.exportInstructor);const {bytes,...info}=await page.evaluate(()=>window.exportInstructor());const buffer=Buffer.from(bytes);info.uid='local-'+createHash('sha256').update(buffer).digest('hex').slice(0,24);await mkdir('public/films/fuse-warmup',{recursive:true});await writeFile('public/films/fuse-warmup/instructor.glb',buffer);await writeFile('public/films/fuse-warmup/instructor.json',JSON.stringify(info,null,2));console.log(info,buffer.length);}finally{await browser.close();}
