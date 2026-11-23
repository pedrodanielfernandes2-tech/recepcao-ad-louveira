# Recepção — AD Louveira

App da recepção da igreja: pedidos de oração, visitantes, **Aceitei a Jesus** e aniversariantes.

- `index.html` — tela do tablet da recepção (qualquer pessoa usa, só **grava**)
- `painel.html` — área da equipe (senha única, **lê** e marca como acompanhado)
- Banco: Supabase, tabelas `recepcao_*` (RLS ativo)

## Publicar na Vercel
1. vercel.com → **Add New… → Project** → importe este repositório.
2. Framework Preset: **Other**. Não precisa de build nem de variáveis.
3. **Deploy**. Cada `git push` publica de novo automaticamente.

## Ajustes rápidos
Edite `js/config.js`: endereço, horários, horário da classe de novos convertidos e tempo de inatividade.

## Segurança
- A chave em `js/config.js` é a pública do Supabase; as regras do banco impedem leitura sem login.
- O tablet volta sozinho à tela inicial após 90 s sem uso.
- Trocar a senha da equipe: Supabase → Authentication → Users → `equipe@recepcao-adlouveira.app` → Reset/Update password.
- Os formulários pedem consentimento (LGPD) antes de enviar.
