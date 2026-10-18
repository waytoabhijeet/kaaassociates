const express=require('express'),Database=require('better-sqlite3'),crypto=require('crypto'),path=require('path');
const PASS=process.env.ADMIN_PASSWORD||'admin12345',USER=process.env.ADMIN_USER||'admin',PORT=process.env.PORT||3000;
if(!PASS||PASS.length<8){console.error('Set ADMIN_PASSWORD (min 8 chars) before starting.');process.exit(1)}
const db=new Database(process.env.DB_PATH||path.join(__dirname,'leads.db'));
const sessions=new Map();

db.exec(`CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,loan_type TEXT,name TEXT,mobile TEXT,email TEXT,city TEXT,amount TEXT,details TEXT,status TEXT DEFAULT 'New',notes TEXT DEFAULT '',ip TEXT)`);
const app=express();app.set('trust proxy',1);app.use(express.json({limit:'20kb'}));app.use(express.urlencoded({extended:false}));
const hits=new Map(),H=s=>crypto.createHash('sha256').update(s).digest();
const eq=(a,b)=>crypto.timingSafeEqual(H(a),H(b));

function auth(req,res,next){
  const[u='',p='']=Buffer.from((req.headers.authorization||'').slice(6),'base64').toString().split(/:(.*)/s);
  if(eq(u,USER)&&eq(p,PASS))return next();
  res.set('WWW-Authenticate','Basic realm="KAA Admin"').sendStatus(401);
}

function getCookie(req,name){
  const cookieHeader=req.headers.cookie||'';
  const cookie=cookieHeader.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));
  return cookie?decodeURIComponent(cookie.slice(name.length+1)):'';
}

function sessionAuth(req){
  const headerAuth=req.headers.authorization;
  if(headerAuth){
    const[u='',p='']=Buffer.from((headerAuth||'').slice(6),'base64').toString().split(/:(.*)/s);
    if(eq(u,USER)&&eq(p,PASS))return true;
  }
  const sessionId=getCookie(req,'kaa_admin_session');
  if(sessionId && sessions.has(sessionId)){
    const now=Date.now();
    const session=sessions.get(sessionId);
    if(!session || session.expires < now){
      sessions.delete(sessionId);
      return false;
    }
    session.expires=now+86400000;
    return true;
  }
  return false;
}

function requireAdmin(req,res,next){
  if(sessionAuth(req)) return next();
  if(req.path.startsWith('/api/')) return res.status(401).json({error:'Unauthorized'});
  return res.redirect('/login');
}

const s=(v,n=200)=>String(v??'').trim().slice(0,n);

app.post('/api/admin/login',(req,res)=>{
  const {username='',password=''}=req.body||{};
  if(username===USER && password===PASS){
    const sessionId=crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId,{username:USER,expires:Date.now()+86400000});
    res.setHeader('Set-Cookie',`kaa_admin_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
    return res.json({ok:true});
  }
  return res.status(401).json({error:'Invalid username or password'});
});

app.post('/api/admin/logout',(req,res)=>{
  const sessionId=getCookie(req,'kaa_admin_session');
  if(sessionId)sessions.delete(sessionId);
  res.clearCookie('kaa_admin_session',{path:'/'});
  res.json({ok:true});
});

app.post('/api/leads',(req,res)=>{
  const b=req.body||{};if(b.website)return res.json({ok:true}); // honeypot
  const now=Date.now(),h=(hits.get(req.ip)||[]).filter(t=>now-t<36e5);
  if(h.length>=10)return res.status(429).json({error:'Too many requests. Please try again later.'});
  const mobile=s(b.mobile,16).replace(/[\s+-]/g,'').replace(/^(91|0)(?=\d{10}$)/,'');
  if(s(b.name).length<2||!/^[6-9]\d{9}$/.test(mobile)||!s(b.loan_type)||b.consent!==true)
    return res.status(400).json({error:'Please enter your name, a valid 10-digit mobile number and accept the consent.'});
  const d={};for(const[k,v]of Object.entries(b.details||{}).slice(0,15))d[s(k,60)]=s(v,300);
  db.prepare('INSERT INTO leads(loan_type,name,mobile,email,city,amount,details,ip) VALUES(?,?,?,?,?,?,?,?)')
    .run(s(b.loan_type,60),s(b.name,100),mobile,s(b.email,120),s(b.city,80),s(b.amount,30),JSON.stringify(d),req.ip);
  hits.set(req.ip,[...h,now]);res.json({ok:true});
});

app.get('/api/admin/leads',(req,res)=>{
  if(!sessionAuth(req)) return res.status(401).json({error:'Unauthorized'});
  return res.json(db.prepare('SELECT * FROM leads ORDER BY id DESC').all().map(l=>({...l,details:JSON.parse(l.details||'{}')})));
});

app.patch('/api/admin/leads/:id',(req,res)=>{
  if(!sessionAuth(req)) return res.status(401).json({error:'Unauthorized'});
  const{status,notes}=req.body||{};
  db.prepare('UPDATE leads SET status=COALESCE(?,status),notes=COALESCE(?,notes) WHERE id=?').run(status==null?null:s(status,40),notes==null?null:s(notes,2000),req.params.id);res.json({ok:true})
});

app.get('/api/admin/export.csv',(req,res)=>{
  if(!sessionAuth(req)) return res.status(401).json({error:'Unauthorized'});
  const c=v=>{v=String(v??'');if(/^[=+\-@]/.test(v))v="'"+v;return'"'+v.replace(/"/g,'""')+'"'};
  const rows=db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  const out=[['ID','Date (UTC)','Loan type','Name','Mobile','Email','City','Amount','Status','Notes','Details']].concat(rows.map(l=>[l.id,l.created_at,l.loan_type,l.name,l.mobile,l.email,l.city,l.amount,l.status,l.notes,
    Object.entries(JSON.parse(l.details||'{}')).map(([k,v])=>k+': '+v).join('; ')]));
  res.type('text/csv').attachment('leads.csv').send(out.map(x=>x.map(c).join(',')).join('\n'));
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req,res) => {
  if (sessionAuth(req)) return res.sendFile(path.join(__dirname, 'admin.html'));
  res.redirect('/login');
});

app.get('/logout',(req,res)=>{
  const sessionId=getCookie(req,'kaa_admin_session');
  if(sessionId)sessions.delete(sessionId);
  res.clearCookie('kaa_admin_session',{path:'/'});
  res.redirect('/login');
});

app.use(express.static(path.join(__dirname,'public')));
app.listen(PORT,()=>console.log('KAA Associates running on port '+PORT));
