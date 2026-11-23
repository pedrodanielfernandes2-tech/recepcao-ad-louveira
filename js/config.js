// Conexão com o Supabase.
// A chave abaixo é a chave PÚBLICA (publishable). Ela pode ficar no site:
// as regras do banco (RLS) só deixam o tablet GRAVAR, e só a equipe logada LER.
window.RECEPCAO_CONFIG = {
  supabaseUrl: 'https://tcvqkkgirxdarldhdeoz.supabase.co',
  supabaseKey: 'sb_publishable_GO8wtvQaIp2jO_2wD342zw_rHU7v4jM',
  // Volta para a tela inicial depois de X segundos sem toque (privacidade no tablet)
  inatividadeSegundos: 90,
  // Login único da equipe (a senha NÃO fica aqui; quem sabe é a equipe)
  emailEquipe: 'equipe@recepcao-adlouveira.app',
  endereco: 'Rua Example, 123 — Louveira, SP',
  horarios: 'Domingo, 09h e 19h · Quarta, 20h',
  classeNovosConvertidos: '[DIA E HORÁRIO DA CLASSE]'
};
