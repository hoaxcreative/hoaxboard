# HOAX BOARD

Central da Hoax: demandas, clientes, financeiro e equipe. É um app web (PWA) que dá para instalar na tela inicial do celular.

## Arquivos

- `index.html`: o app inteiro
- `firebase-config.js`: chaves do Firebase e e-mail da dona do board
- `firestore.rules`: regras de acesso (colar no Firebase)
- `sw.js`: deixa o app abrir sem internet; mude `CACHE` (`hoaxboard-vN`) a cada atualização
- `manifest.webmanifest`, `icon*.png`, `icon.svg`, `logo.svg`: instalação e marca

Sem o Firebase configurado, o app roda em modo teste: os dados ficam só no aparelho.

## Configurar o Firebase (uma vez)

1. Em console.firebase.google.com, crie o projeto `hoax-board` (o Google Analytics pode ficar desligado).
2. Authentication › Começar › Google › Ativar.
3. Authentication › Configurações › Domínios autorizados › adicionar `hoaxcreative.github.io`.
4. Firestore Database › Criar banco de dados › local `southamerica-east1` › modo produção.
5. Firestore › Regras: cole o `firestore.rules` (com o e-mail da dona no lugar de `TROCAR@gmail.com`) e publique.
6. Configurações do projeto › Seus apps › Web (`</>`) › registre `hoax-board` e copie o `firebaseConfig` para o `firebase-config.js`. Preencha também `HOAX_DONO`.

## Dados no Firestore

- `membros/{email}`: nome, papel (`admin` ou `equipe`), foto
- `clientes`, `demandas`, `anexos` (links e miniaturas), `arquivos` (imagem inteira de cada anexo)
- `lancamentos`: só admins leem e escrevem
- `config/listas`: listas editáveis (serviços, tipos, categorias, formas de pagamento)
