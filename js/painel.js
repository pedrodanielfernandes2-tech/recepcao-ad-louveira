(function () {
  const cfg = window.RECEPCAO_CONFIG;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, storageKey: 'recepcao-adl-painel' }
  });
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const ABAS = {
    decisoes: { tabela: 'recepcao_decisoes', feito: 'acompanhado', rotuloFeito: 'Acompanhado' },
    pedidos: { tabela: 'recepcao_pedidos', feito: 'atendido', rotuloFeito: 'Orado / atendido' },
    visitantes: { tabela: 'recepcao_visitantes', feito: 'contatado', rotuloFeito: 'Contatado' },
    aniversariantes: { tabela: 'recepcao_aniversariantes' }
  };
  let aba = 'decisoes';
  let linhas = [];

  // ---------- Login ----------
  async function iniciar() {
    const { data } = await db.auth.getSession();
    if (data.session) entrou(); else mostrarLogin();
  }
  function mostrarLogin() {
    $('#form-login').hidden = false; $('#painel').hidden = true; $('#sair').hidden = true;
  }
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = $('#erro-login'); erro.hidden = true;
    const senha = e.target.elements.senha.value;
    const { error } = await db.auth.signInWithPassword({ email: cfg.emailEquipe, password: senha });
    if (error) { erro.textContent = 'Senha incorreta.'; erro.hidden = false; return; }
    e.target.reset();
    entrou();
  });
  $('#sair').addEventListener('click', async () => { await db.auth.signOut(); mostrarLogin(); });

  function entrou() {
    $('#form-login').hidden = true; $('#painel').hidden = false; $('#sair').hidden = false;
    trocarAba(aba);
    contarPendentes();
  }

  // ---------- Abas e filtros ----------
  $$('[data-aba]').forEach(b => b.addEventListener('click', () => trocarAba(b.dataset.aba)));
  function trocarAba(nova) {
    aba = nova;
    $$('[data-aba]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
    const ehNiver = aba === 'aniversariantes';
    $('#novo-niver').hidden = !ehNiver;
    $('#f-periodo').hidden = ehNiver;
    $('#f-pendentes').closest('label').hidden = ehNiver;
    carregar();
  }
  ['#f-periodo', '#f-pendentes'].forEach(s => $(s).addEventListener('change', carregar));
  $('#f-busca').addEventListener('input', desenhar);

  async function contarPendentes() {
    for (const k of ['decisoes', 'pedidos', 'visitantes']) {
      const a = ABAS[k];
      const { count } = await db.from(a.tabela).select('id', { count: 'exact', head: true }).eq(a.feito, false);
      $('[data-n="' + k + '"]').textContent = count ? '(' + count + ')' : '';
    }
  }

  async function carregar() {
    const erro = $('#erro-painel'); erro.hidden = true;
    const a = ABAS[aba];
    let q = db.from(a.tabela).select('*');
    if (aba === 'aniversariantes') {
      q = q.order('nome');
    } else {
      const periodo = $('#f-periodo').value;
      if (periodo === 'hoje') {
        const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
        q = q.gte('criado_em', inicio.toISOString());
      } else {
        const dias = Number(periodo);
        if (dias > 0) q = q.gte('criado_em', new Date(Date.now() - dias * 864e5).toISOString());
      }
      if ($('#f-pendentes').checked) q = q.eq(a.feito, false);
      q = q.order('criado_em', { ascending: false });
    }
    const { data, error } = await q;
    if (error) {
      if (error.code === 'PGRST301' || /JWT/i.test(error.message)) { mostrarLogin(); return; }
      erro.textContent = 'Erro ao carregar: ' + error.message; erro.hidden = false; linhas = [];
    } else linhas = data || [];
    if (aba === 'aniversariantes') {
      linhas.sort((x, y) => x.nascimento.slice(5).localeCompare(y.nascimento.slice(5)));
    }
    desenhar();
  }

  // ---------- Desenho ----------
  const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDia = (d) => d ? d.split('-').reverse().join('/') : '';
  function zap(tel) {
    const n = (tel || '').replace(/\D/g, '');
    if (n.length < 10) return null;
    return 'https://wa.me/' + (n.length <= 11 ? '55' + n : n);
  }
  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function desenhar() {
    const busca = $('#f-busca').value.trim().toLowerCase();
    const lista = $('#registros'); lista.innerHTML = '';
    const itens = linhas.filter(r => !busca || (r.nome || '').toLowerCase().includes(busca));
    $('#vazio').hidden = itens.length > 0;
    const a = ABAS[aba];

    for (const r of itens) {
      const card = el('div', 'registro' + (a.feito && r[a.feito] ? ' feito' : ''));
      const esq = el('div');
      esq.append(el('div', 'nome', r.nome));
      const meta = el('div', 'meta');
      const lado = el('div', 'lado');

      if (aba === 'aniversariantes') {
        meta.append(el('span', null, 'Nascimento: ' + fmtDia(r.nascimento)));
        const apagar = el('button', 'link-apagar', 'Remover');
        apagar.type = 'button';
        apagar.onclick = async () => {
          if (apagar.dataset.confirmar !== '1') { apagar.dataset.confirmar = '1'; apagar.textContent = 'Toque de novo para remover'; return; }
          const { error } = await db.from(a.tabela).delete().eq('id', r.id);
          if (!error) carregar();
        };
        lado.append(apagar);
      } else {
        meta.append(el('span', null, fmtData(r.criado_em)));
        const tel = r.telefone || r.whatsapp;
        if (tel) meta.append(el('span', null, tel));
        if (r.bairro) meta.append(el('span', null, r.bairro));
        if (r.nascimento) meta.append(el('span', null, 'Nasc.: ' + fmtDia(r.nascimento)));
        const link = zap(tel);
        if (link) { const z = el('a', 'zap', 'Abrir WhatsApp'); z.href = link; z.target = '_blank'; z.rel = 'noopener'; lado.append(z); }
        const marcar = el('label', 'check');
        marcar.style.fontSize = '14px';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!r[a.feito];
        cb.onchange = async () => {
          const { error } = await db.from(a.tabela).update({ [a.feito]: cb.checked }).eq('id', r.id);
          if (error) { cb.checked = !cb.checked; return; }
          r[a.feito] = cb.checked;
          card.classList.toggle('feito', cb.checked);
          contarPendentes();
        };
        marcar.append(cb, document.createTextNode(a.rotuloFeito));
        lado.append(marcar);
      }
      esq.append(meta);
      card.append(esq, lado);

      const tags = el('div', 'tags');
      if (aba === 'decisoes') {
        tags.append(el('span', 'tag', r.tipo === 'reconciliou' ? 'Reconciliação' : 'Aceitou Jesus'));
        if (r.classe) tags.append(el('span', 'tag', 'Classe de novos convertidos'));
        if (r.batismo) tags.append(el('span', 'tag', 'Batismo'));
        if (r.biblia) tags.append(el('span', 'tag alerta', 'Quer Bíblia'));
        if (r.convidado_por) tags.append(el('span', 'tag', 'Convidado por ' + r.convidado_por));
      }
      if (aba === 'pedidos' && r.quer_ligacao) tags.append(el('span', 'tag alerta', 'Quer ligação de pastor'));
      if (aba === 'pedidos' && !r.consentimento) tags.append(el('span', 'tag', 'Sem autorização para guardar contato'));
      if (aba === 'visitantes') {
        if (r.primeira_vez) tags.append(el('span', 'tag', 'Primeira visita'));
        if (r.quer_contato) tags.append(el('span', 'tag alerta', 'Quer contato'));
        if (r.como_conheceu) tags.append(el('span', 'tag', r.como_conheceu));
      }
      if (tags.childElementCount) card.append(tags);
      if (aba === 'pedidos') card.append(el('div', 'texto', r.pedido));
      lista.append(card);
    }
  }

  // ---------- Aniversariantes: adicionar ----------
  $('#novo-niver').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const { error } = await db.from('recepcao_aniversariantes').insert({ nome: f.nome.value.trim(), nascimento: f.nascimento.value });
    if (error) { $('#erro-painel').textContent = 'Erro ao adicionar: ' + error.message; $('#erro-painel').hidden = false; return; }
    e.target.reset();
    carregar();
  });

  // ---------- Exportar CSV ----------
  $('#exportar').addEventListener('click', () => {
    if (!linhas.length) return;
    const colunas = Object.keys(linhas[0]);
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = '﻿' + [colunas.join(';')].concat(linhas.map(r => colunas.map(c => esc(r[c])).join(';'))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = aba + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  iniciar();
})();
