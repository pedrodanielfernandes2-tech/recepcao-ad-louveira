(function () {
  const cfg = window.RECEPCAO_CONFIG;
  // persistSession:false — o tablet nunca guarda login de ninguém
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: false } });

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  $$('[data-cfg]').forEach(el => { el.textContent = cfg[el.dataset.cfg] || ''; });

  // ---------- Navegação ----------
  const VIEWS = ['inicio', 'oracao', 'visitante', 'decisao', 'aniversariantes'];
  function mostrar() {
    const v = (location.hash || '#inicio').slice(1);
    const atual = VIEWS.includes(v) ? v : 'inicio';
    $$('[data-view]').forEach(s => { s.hidden = s.dataset.view !== atual; });
    window.scrollTo(0, 0);
    if (atual === 'inicio') carregarContagem();
    if (atual === 'aniversariantes') carregarAniversariantes();
    if (['oracao', 'visitante', 'decisao'].includes(atual)) resetarForm(atual);
  }
  window.addEventListener('hashchange', mostrar);

  // Volta ao início por inatividade (e limpa o que estava digitado)
  let timer;
  function cutucar() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (location.hash && location.hash !== '#inicio') location.hash = '#inicio';
    }, (cfg.inatividadeSegundos || 90) * 1000);
  }
  ['pointerdown', 'keydown', 'input'].forEach(e => document.addEventListener(e, cutucar, { passive: true }));

  // ---------- Início: contadores ----------
  let offset = 0, avisoFechadoEm = null;
  function dataDoOffset() {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d;
  }
  function isoLocal(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  async function carregarContagem() {
    const d = dataDoOffset();
    const fmt = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    $('#rotulo-dia').textContent = offset === 0 ? 'Hoje, ' + fmt : offset === -1 ? 'Ontem, ' + fmt : offset === 1 ? 'Amanhã, ' + fmt : fmt;

    let c = { pedidos: 0, visitantes: 0, decisoes: 0, aniversariantes: 0 };
    const { data, error } = await db.rpc('recepcao_contagem_dia', { dia: isoLocal(d) });
    if (!error && data) c = data;

    for (const k of Object.keys(c)) {
      const el = $('[data-selo="' + k + '"]');
      if (el) { el.textContent = c[k]; el.hidden = !(c[k] > 0); }
    }
    const partes = [];
    const p = (n, um, varios) => n > 0 && partes.push(n + ' ' + (n === 1 ? um : varios));
    p(c.pedidos, 'pedido de oração', 'pedidos de oração');
    p(c.visitantes, 'visitante', 'visitantes');
    p(c.decisoes, 'decisão por Cristo', 'decisões por Cristo');
    p(c.aniversariantes, 'aniversariante', 'aniversariantes');
    const mostrarAviso = partes.length > 0 && avisoFechadoEm !== offset;
    $('#aviso').hidden = !mostrarAviso;
    $('#aviso-texto').textContent = 'Nesse dia: ' + partes.join(', ') + '.';
  }
  $('#dia-anterior').onclick = () => { offset--; carregarContagem(); };
  $('#dia-seguinte').onclick = () => { offset++; carregarContagem(); };
  $('#aviso-fechar').onclick = () => { avisoFechadoEm = offset; $('#aviso').hidden = true; };

  // ---------- Formulários ----------
  const TABELAS = { oracao: 'recepcao_pedidos', visitante: 'recepcao_visitantes', decisao: 'recepcao_decisoes' };
  const OBRIGATORIOS = { oracao: ['nome', 'pedido'], visitante: ['nome'], decisao: ['nome'] };

  function resetarForm(nome) {
    const form = $('[data-form="' + nome + '"]');
    form.reset();
    form.hidden = false;
    $('[data-sucesso="' + nome + '"]').hidden = true;
    $('[data-erro]', form).hidden = true;
    if (nome === 'decisao') escolherTipo('aceitou');
    validar(form, nome);
  }

  function validar(form, nome) {
    const faltando = OBRIGATORIOS[nome].filter(c => !form.elements[c].value.trim());
    const consent = form.elements.consentimento.checked;
    const ok = faltando.length === 0 && consent;
    $('button[type="submit"]', form).disabled = !ok;
    $('[data-dica]', form).textContent = ok ? 'Tudo certo? É só enviar.'
      : faltando.length ? 'Preencha ' + (faltando.includes('pedido') && faltando.includes('nome') ? 'o nome e o pedido' : faltando.includes('pedido') ? 'o pedido' : 'o nome') + ' para continuar.'
      : 'Marque a autorização para continuar.';
    return ok;
  }

  function lerForm(form) {
    const dados = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') dados[el.name] = el.checked;
      else { const v = el.value.trim(); dados[el.name] = v === '' ? null : v; }
    }
    return dados;
  }

  function escolherTipo(tipo) {
    const form = $('[data-form="decisao"]');
    form.elements.tipo.value = tipo;
    $$('[data-tipo]', form).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo)));
  }
  $$('[data-tipo]').forEach(b => b.addEventListener('click', () => escolherTipo(b.dataset.tipo)));

  Object.keys(TABELAS).forEach(nome => {
    const form = $('[data-form="' + nome + '"]');
    form.addEventListener('input', () => validar(form, nome));
    form.addEventListener('change', () => validar(form, nome));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validar(form, nome)) return;
      const btn = $('button[type="submit"]', form);
      const erro = $('[data-erro]', form);
      erro.hidden = true;
      btn.disabled = true;
      const textoOriginal = btn.textContent;
      btn.textContent = 'Enviando...';
      const dados = lerForm(form);
      // sem .select(): o tablet não tem permissão de leitura, só de gravação
      const { error } = await db.from(TABELAS[nome]).insert(dados);
      btn.textContent = textoOriginal;
      if (error) {
        console.error(error);
        erro.textContent = 'Não conseguimos enviar agora. Verifique a internet e tente de novo.';
        erro.hidden = false;
        btn.disabled = false;
        return;
      }
      if (nome === 'decisao') prepararSucessoDecisao(dados);
      form.hidden = true;
      $('[data-sucesso="' + nome + '"]').hidden = false;
      window.scrollTo(0, 0);
    });
    $('[data-novo="' + nome + '"]').addEventListener('click', () => resetarForm(nome));
  });

  function prepararSucessoDecisao(d) {
    const primeiro = (d.nome || '').split(/\s+/)[0] || '';
    const voltando = d.tipo === 'reconciliou';
    $('[data-decisao-titulo]').textContent = voltando
      ? 'Que bom ter você de volta' + (primeiro ? ', ' + primeiro : '') + '!'
      : 'Bem-vindo(a) à família' + (primeiro ? ', ' + primeiro : '') + '!';
    $('[data-decisao-sub]').textContent = voltando
      ? 'O céu se alegra com a sua volta. Estamos aqui com você.'
      : 'Hoje começa uma nova vida em Cristo. Estamos aqui com você.';
    $('[data-passo="classe"]').hidden = !d.classe;
    $('[data-passo="biblia"]').hidden = !d.biblia;
  }

  // ---------- Aniversariantes ----------
  async function carregarAniversariantes() {
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    $('#niver-titulo').textContent = 'Aniversariantes de ' + MESES[mes - 1].replace(/^./, c => c.toUpperCase());
    const lista = $('#niver-lista');
    lista.innerHTML = '';
    const { data, error } = await db.rpc('recepcao_aniversariantes_mes', { mes });
    const itens = error ? [] : (data || []);
    $('#niver-total').textContent = itens.length + (itens.length === 1 ? ' este mês' : ' este mês');
    $('#niver-vazio').hidden = itens.length > 0;
    for (const p of itens) {
      const div = document.createElement('div');
      div.className = 'niver' + (p.dia === hoje.getDate() ? ' hoje' : '');
      const dia = document.createElement('div'); dia.className = 'dia'; dia.textContent = String(p.dia).padStart(2, '0');
      const info = document.createElement('div');
      const n = document.createElement('div'); n.className = 'nome'; n.textContent = p.nome;
      const q = document.createElement('div'); q.className = 'quando';
      q.textContent = p.dia === hoje.getDate() ? 'Hoje — feliz aniversário!' : p.dia + ' de ' + MESES[mes - 1];
      info.append(n, q); div.append(dia, info); lista.append(div);
    }
  }

  mostrar();
  cutucar();
})();
