const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
app.use(express.json({limit:'2mb'}));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized:false } : undefined });
async function init(){ await pool.query(`CREATE TABLE IF NOT EXISTS shared_state (id INTEGER PRIMARY KEY CHECK (id=1), state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by TEXT)`); }
app.get('/api/health', async (_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true});}catch(e){res.status(500).json({ok:false});}});
app.get('/api/state', async (_req,res)=>{try{const q=await pool.query('SELECT state, updated_at, updated_by FROM shared_state WHERE id=1');res.json(q.rows[0]||{state:null});}catch(e){console.error(e);res.status(500).json({error:'读取共享数据失败'});}});
app.put('/api/state', async (req,res)=>{try{const {state,operator='匿名玩家'}=req.body||{};if(!state||!Array.isArray(state.channels)||state.channels.length!==60) return res.status(400).json({error:'数据格式无效'});await pool.query(`INSERT INTO shared_state(id,state,updated_at,updated_by) VALUES(1,$1,NOW(),$2) ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state,updated_at=NOW(),updated_by=EXCLUDED.updated_by`,[JSON.stringify(state),String(operator).slice(0,40)]);res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'保存共享数据失败'});}});
app.use(express.static(path.join(__dirname,'public')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const port=process.env.PORT||3000;
init().then(()=>app.listen(port,'0.0.0.0',()=>console.log(`BOSS Hunter listening on ${port}`))).catch(e=>{console.error(e);process.exit(1)});
