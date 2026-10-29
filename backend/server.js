import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'staffsync-demo-secret-change-me';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');
let mongoOn = false;

const schemas = {
  User: new mongoose.Schema({ name: String, email: {type:String, unique:true}, password: String, role: {type:String, default:'employee'} }, {timestamps:true}),
  Employee: new mongoose.Schema({ name:String, email:String, department:String, position:String, phone:String, status:{type:String,default:'Active'}, joinedAt:{type:String,default:()=>new Date().toISOString().slice(0,10)} }, {timestamps:true}),
  Attendance: new mongoose.Schema({ employeeId:String, employeeName:String, date:String, status:String, checkIn:String, checkOut:String }, {timestamps:true}),
  Leave: new mongoose.Schema({ employeeId:String, employeeName:String, type:String, from:String, to:String, reason:String, status:{type:String,default:'Pending'} }, {timestamps:true}),
  Announcement: new mongoose.Schema({ title:String, message:String, author:String, date:{type:String,default:()=>new Date().toISOString().slice(0,10)} }, {timestamps:true}),
  Training: new mongoose.Schema({ title:String, description:String, department:String, date:String, status:{type:String,default:'Scheduled'} }, {timestamps:true})
};
const models = {};
for (const [name, schema] of Object.entries(schemas)) models[name] = mongoose.models[name] || mongoose.model(name, schema);

const seed = {
  users: [{id:'u-admin',name:'HR Admin',email:'admin@staffsync.demo',passwordHash:'',role:'admin'}],
  employees: [
    {id:'e1',name:'Aarav Sharma',email:'aarav@staffsync.demo',department:'Engineering',position:'Frontend Developer',phone:'9876501001',status:'Active',joinedAt:'2024-02-12'},
    {id:'e2',name:'Diya Patel',email:'diya@staffsync.demo',department:'Human Resources',position:'HR Executive',phone:'9876501002',status:'Active',joinedAt:'2023-08-01'},
    {id:'e3',name:'Kabir Verma',email:'kabir@staffsync.demo',department:'Finance',position:'Accountant',phone:'9876501003',status:'Active',joinedAt:'2024-06-17'},
    {id:'e4',name:'Anaya Singh',email:'anaya@staffsync.demo',department:'Marketing',position:'Marketing Associate',phone:'9876501004',status:'Active',joinedAt:'2022-11-03'}
  ],
  attendance: [],
  leaves: [{id:'l1',employeeId:'e2',employeeName:'Diya Patel',type:'Casual Leave',from:'2026-11-02',to:'2026-11-03',reason:'Family function',status:'Pending'}],
  announcements: [{id:'a1',title:'Welcome to StaffSync',message:'Use this portal for attendance, leave requests, and HR updates.',author:'HR Admin',date:new Date().toISOString().slice(0,10)}],
  trainings: [{id:'t1',title:'Workplace Safety',description:'Annual safety and compliance refresher.',department:'All Departments',date:'2026-11-10',status:'Scheduled'}]
};
let store = null;
async function loadStore() {
  try { store = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch {
    store = structuredClone(seed);
    store.users[0].passwordHash = await bcrypt.hash('Admin@123', 10);
    await saveStore();
  }
}
async function saveStore() { await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2)); }
function publicUser(u) { return { id: u.id || u._id, name:u.name, email:u.email, role:u.role }; }
function tokenFor(u) { return jwt.sign({ id:String(u.id || u._id), role:u.role, name:u.name, email:u.email }, SECRET, {expiresIn:'12h'}); }
function auth(req,res,next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  try { if (!token) throw Error(); req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({message:'Please sign in again.'}); }
}
function admin(req,res,next) { if(req.user?.role !== 'admin' && req.user?.role !== 'manager') return res.status(403).json({message:'Admin/manager access required.'}); next(); }
async function all(collection) { return mongoOn ? models[collection[0].toUpperCase()+collection.slice(1)].find().sort({createdAt:-1}).lean() : store[collection]; }
async function insert(collection, data) {
  if (mongoOn) return models[collection[0].toUpperCase()+collection.slice(1)].create(data);
  const item = {id:collection.slice(0,1)+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6), ...data, createdAt:new Date().toISOString()};
  store[collection].unshift(item); await saveStore(); return item;
}
async function update(collection,id,patch) {
  if(mongoOn) return models[collection[0].toUpperCase()+collection.slice(1)].findByIdAndUpdate(id,patch,{new:true}).lean();
  const item=store[collection].find(x=>x.id===id); if(!item)return null; Object.assign(item,patch); await saveStore(); return item;
}
async function remove(collection,id) {
  if(mongoOn) { const r=await models[collection[0].toUpperCase()+collection.slice(1)].findByIdAndDelete(id); return !!r; }
  const before=store[collection].length; store[collection]=store[collection].filter(x=>x.id!==id); await saveStore(); return before!==store[collection].length;
}

app.get('/api/health',(req,res)=>res.json({ok:true,storage:mongoOn?'MongoDB':'JSON file'}));
app.post('/api/auth/login', async (req,res)=>{
  const email=String(req.body.email||'').toLowerCase().trim(), password=String(req.body.password||'');
  let u;
  if(mongoOn) u=await models.User.findOne({email});
  else u=store.users.find(x=>x.email===email);
  if(!u || !(await bcrypt.compare(password,u.passwordHash || u.password || ''))) return res.status(401).json({message:'Invalid email or password.'});
  const safe=publicUser(u); res.json({token:tokenFor(safe),user:safe});
});
app.post('/api/auth/register',async(req,res)=>{
  const {name,email,password}=req.body;
  if(!name?.trim()||!email?.trim()||!password||password.length<6) return res.status(400).json({message:'Name, email, and password (at least 6 characters) are required.'});
  const normalized=email.toLowerCase().trim();
  const existing=mongoOn?await models.User.findOne({email:normalized}):store.users.find(x=>x.email===normalized);
  if(existing)return res.status(409).json({message:'An account with this email already exists.'});
  const passwordHash=await bcrypt.hash(password,10);
  let u;
  if(mongoOn) u=await models.User.create({name:name.trim(),email:normalized,password:passwordHash,role:'employee'});
  else {u={id:'u-'+Date.now(),name:name.trim(),email:normalized,passwordHash,role:'employee'};store.users.push(u);await saveStore();}
  const safe=publicUser(u);res.status(201).json({token:tokenFor(safe),user:safe});
});
app.get('/api/dashboard',auth,async(req,res)=>{
  const [employees,attendance,leaves,announcements,trainings]=await Promise.all(['employees','attendance','leaves','announcements','trainings'].map(all));
  const today=new Date().toISOString().slice(0,10);
  res.json({employees:employees.length,attendanceToday:attendance.filter(x=>x.date===today).length,pendingLeaves:leaves.filter(x=>x.status==='Pending').length,announcements:announcements.length,recentLeaves:leaves.slice(0,5),recentAnnouncements:announcements.slice(0,4)});
});
const collections=['employees','attendance','leaves','announcements','trainings'];
for(const collection of collections){
  app.get('/api/'+collection,auth,async(req,res)=>res.json(await all(collection)));
  app.post('/api/'+collection,auth,async(req,res)=>{
    const data={...req.body};
    if(collection==='leaves'){data.employeeId=data.employeeId||req.user.id;data.employeeName=data.employeeName||req.user.name;data.status='Pending';}
    if(collection==='attendance'){data.date=data.date||new Date().toISOString().slice(0,10);data.employeeName=data.employeeName||req.user.name;}
    if(collection==='announcements'){if(req.user.role==='employee')return res.status(403).json({message:'Only HR/admin can post announcements.'});data.author=req.user.name;}
    if(collection==='trainings' && req.user.role==='employee')return res.status(403).json({message:'Only HR/admin can manage training.'});
    const item=await insert(collection,data);res.status(201).json(item);
  });
  app.patch('/api/'+collection+'/:id',auth,async(req,res)=>{
    if(['leaves','employees','announcements','trainings'].includes(collection) && !['admin','manager'].includes(req.user.role))return res.status(403).json({message:'Admin/manager access required.'});
    const item=await update(collection,req.params.id,req.body);if(!item)return res.status(404).json({message:'Record not found.'});res.json(item);
  });
  app.delete('/api/'+collection+'/:id',auth,admin,async(req,res)=>{
    const ok=await remove(collection,req.params.id);res.status(ok?204:404).end();
  });
}
async function start(){
  if(process.env.MONGO_URI){
    try{await mongoose.connect(process.env.MONGO_URI);mongoOn=true;console.log('Connected to MongoDB');
      if(!await models.User.findOne({email:'admin@staffsync.demo'})){await models.User.create({name:'HR Admin',email:'admin@staffsync.demo',password:await bcrypt.hash('Admin@123',10),role:'admin'});}
    }
    catch(e){console.warn('MongoDB unavailable; using JSON file storage:',e.message);}
  }
  if(!mongoOn) await loadStore();
  app.listen(PORT,()=>console.log(`StaffSync API running at http://localhost:${PORT} (${mongoOn?'MongoDB':'JSON file storage'})`));
}
start();
