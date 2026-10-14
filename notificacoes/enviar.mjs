// Envia as notificações do HOAX BOARD. Roda sozinho no GitHub a cada 30 minutos (.github/workflows/notificacoes.yml).
// Lê membros/{email}.push (que o app escreve) e guarda o que já mandou em sistema/notif_{email}.
// Precisa do segredo FIREBASE_SERVICE_ACCOUNT no GitHub (a chave da conta de serviço do Firebase).
import admin from 'firebase-admin';

// Lê a chave mesmo se ela foi colada com o começo ou o fim cortados (só precisa destes 3 campos).
function chave(txt = '') {
  try { return JSON.parse(txt); } catch (e) {}
  const campo = n => (txt.match(new RegExp(`"?${n}"?\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)) || [])[1];
  const k = { project_id: campo('project_id'), client_email: campo('client_email'), private_key: (campo('private_key') || '').replace(/\\n/g, '\n') };
  if (!k.project_id || !k.client_email || !k.private_key.includes('PRIVATE KEY')) {
    console.error('A chave FIREBASE_SERVICE_ACCOUNT está incompleta. Cole o arquivo .json inteiro, do { até o }.');
    process.exit(1);
  }
  return k;
}
admin.initializeApp({ credential: admin.credential.cert(chave(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const agora = Date.now();

// Data e hora de cada pessoa (o app manda o fuso; Brasil = 180 minutos atrás do UTC).
function local(tz) {
  const d = new Date(agora - (tz ?? 180) * 60e3);
  return { dia: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
}
const mais1 = dia => new Date(Date.parse(dia) + 864e5).toISOString().slice(0, 10);
const primeiro = n => String(n || '').trim().split(/[\s@]/)[0] || 'Alguém';
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const lista = (itens, max = 3) => itens.slice(0, max).map(d => d.titulo || d.descricao).join(', ') + (itens.length > max ? ` e mais ${itens.length - max}` : '');
const docs = async ref => (await ref.get()).docs.map(d => ({ ...d.data(), id: d.id }));

const membros = await docs(db.collection('membros'));
const comPush = membros.filter(m => (m.push?.tokens || []).length);
if (!comPush.length) { console.log('Ninguém com notificações ativadas.'); process.exit(0); }

const demandas = await docs(db.collection('demandas'));
const comentarios = await docs(db.collection('comentarios'));
const lancamentos = await docs(db.collection('lancamentos'));
const nomeDe = email => primeiro(membros.find(m => m.id === email)?.nome || email);

let enviadas = 0;
for (const m of comPush) {
  const email = m.id, L = local(m.push.tz);
  if (L.hora < 7 || L.hora >= 22) continue; // não incomoda de madrugada
  const prefs = { prazos: true, financeiro: true, equipe: true, ...(m.push.prefs || {}) };
  const ref = db.collection('sistema').doc('notif_' + email);
  const s = (await ref.get()).data() || {};
  if (!s.visto) s.visto = agora; // primeira vez: não manda o histórico antigo
  const msgs = [];

  // 1. Resumo da manhã (a partir das 8h, uma vez por dia): demandas da Hoax com a pessoa (ou sem ninguém) e os freelas dela.
  if (prefs.prazos && s.dia !== L.dia && L.hora >= 8) {
    s.dia = L.dia;
    const meus = (await docs(db.collection('pessoal').doc(email).collection('demandas'))).map(d => ({ ...d, pes: true }));
    const abertas = [...demandas.filter(d => !(d.resp || []).length || (d.resp || []).includes(email)), ...meus]
      .filter(d => d.status !== 'entregue' && d.prazo);
    const atrasadas = abertas.filter(d => d.prazo < L.dia), hoje = abertas.filter(d => d.prazo === L.dia), amanha = abertas.filter(d => d.prazo === mais1(L.dia));
    const partes = [];
    if (hoje.length) partes.push(`Hoje: ${lista(hoje)}.`);
    if (amanha.length) partes.push(`Amanhã: ${lista(amanha)}.`);
    if (atrasadas.length) partes.push(`${atrasadas.length === 1 ? '1 atrasada' : atrasadas.length + ' atrasadas'}: ${lista(atrasadas, 2)}.`);
    if (partes.length) msgs.push({ body: `Bom dia, ${primeiro(m.nome)}! ${partes.join(' ')}`, tag: 'prazos' });
  }

  // 2. Financeiro (a partir das 9h, uma vez por dia, só admins): pagamentos vencendo hoje ou vencidos.
  if (prefs.financeiro && m.papel === 'admin' && s.diaFin !== L.dia && L.hora >= 9) {
    s.diaFin = L.dia;
    const meus = await docs(db.collection('pessoal').doc(email).collection('lancamentos'));
    const pend = [...lancamentos, ...meus].filter(l => l.status === 'pendente' && l.vencimento && l.vencimento <= L.dia);
    const vencidos = pend.filter(l => l.vencimento < L.dia), hoje = pend.filter(l => l.vencimento === L.dia);
    const receber = pend.filter(l => l.tipo === 'entrada').reduce((a, l) => a + Number(l.valor || 0), 0);
    const pagar = pend.filter(l => l.tipo !== 'entrada').reduce((a, l) => a + Number(l.valor || 0), 0);
    if (pend.length) {
      const t = [];
      if (hoje.length) t.push(`${hoje.length === 1 ? '1 pagamento vence' : hoje.length + ' pagamentos vencem'} hoje`);
      if (vencidos.length) t.push(`${vencidos.length === 1 ? '1 vencido' : vencidos.length + ' vencidos'}`);
      const v = [receber ? `${brl(receber)} a receber` : '', pagar ? `${brl(pagar)} a pagar` : ''].filter(Boolean).join(' e ');
      msgs.push({ body: `${t.join(' e ')}: ${v}.`, tag: 'financeiro' });
    }
  }

  // 3. Equipe (a cada execução): comentários do outro sócio e demandas novas que ele colocou para a pessoa.
  if (prefs.equipe) {
    const desde = s.visto;
    const minhas = new Set(demandas.filter(d => (d.resp || []).includes(email) || d.por === email).map(d => d.id));
    const novosCom = comentarios.filter(c => (c.criado || 0) > desde && c.por !== email && minhas.has(c.demanda));
    for (const c of novosCom.slice(0, 2)) {
      const d = demandas.find(x => x.id === c.demanda);
      msgs.push({ body: `${nomeDe(c.por)} comentou em "${d?.titulo || 'uma demanda'}": ${String(c.texto).slice(0, 120)}`, tag: 'com-' + c.demanda });
    }
    const novas = demandas.filter(d => (d.criado || 0) > desde && d.por && d.por !== email && (d.resp || []).includes(email));
    if (novas.length) msgs.push({ body: `${nomeDe(novas[0].por)} colocou ${novas.length === 1 ? `"${novas[0].titulo}"` : novas.length + ' demandas novas'} com você.`, tag: 'novas' });
  }
  s.visto = agora;

  let tokens = m.push.tokens;
  for (const msg of msgs.slice(0, 3)) {
    const r = await admin.messaging().sendEachForMulticast({
      tokens,
      data: { title: 'HOAX BOARD', body: msg.body, tag: msg.tag, url: './' },
      webpush: { headers: { Urgency: 'high', TTL: String(6 * 3600) } },
    });
    const mortos = tokens.filter((t, i) => ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'].includes(r.responses[i].error?.code));
    if (mortos.length) {
      await db.collection('membros').doc(email).update({ 'push.tokens': admin.firestore.FieldValue.arrayRemove(...mortos) });
      tokens = tokens.filter(t => !mortos.includes(t));
    }
    enviadas += r.successCount;
    if (!tokens.length) break;
  }
  await ref.set(s);
}
console.log(`${comPush.length} pessoas com notificações, ${enviadas} enviadas.`);
