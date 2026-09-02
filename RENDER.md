# Deploy no Render

O projeto está configurado para ser publicado como um único Web Service. O
Express executa a API e serve o build do React no mesmo endereço.

## Configuração automática

O arquivo `render.yaml` fica na raiz do repositório e define:

- instalação e build do frontend;
- instalação e execução do backend;
- publicação do frontend em `/`;
- API em `/api`;
- armazenamento do SQLite e das imagens em `backend/data`.

## Publicação

1. Acesse <https://dashboard.render.com/> e entre com sua conta GitHub.
2. Selecione **New > Blueprint**.
3. Conecte o repositório `sessojunior/stock-control`.
4. Selecione a branch `main` e confirme o Blueprint.
5. Aguarde o primeiro deploy.
6. Abra a URL fornecida pelo Render. A mesma URL deve exibir o frontend e responder à API.

## Teste rápido

Substitua `SUA_URL` pela URL gerada:

```text
GET SUA_URL/
GET SUA_URL/api/products
GET SUA_URL/api/suppliers
```

No Insomnia, use a mesma URL para criar, consultar, alterar e excluir produtos
e fornecedores. Por exemplo:

```text
POST SUA_URL/api/products
POST SUA_URL/api/suppliers
```

Os corpos JSON e os demais endpoints estão documentados no código das rotas em
`backend/routes`.

## Importante sobre os dados

O plano gratuito não oferece persistência garantida para o SQLite e os uploads.
O CRUD funcionará para a demonstração, mas os dados podem ser perdidos após
reinício ou novo deploy. Para preservar os dados, anexe um Persistent Disk pago
no Render com o caminho:

```text
/opt/render/project/src/backend/data
```

Depois, faça um novo deploy.
