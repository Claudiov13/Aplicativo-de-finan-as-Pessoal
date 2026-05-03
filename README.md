# Finance Control App

Este é um aplicativo de controle financeiro pessoal construído com React, Vite e Firebase.

## Configuração para Desenvolvimento (GitHub)

Como este projeto utiliza Firebase, você precisará configurar suas próprias chaves para que o app funcione localmente ou em produção fora do ambiente AI Studio.

1.  Crie um arquivo `.env` na raiz do projeto.
2.  Copie o conteúdo de `.env.example` para o seu `.env`.
3.  Preencha as variáveis com os valores do seu console do Firebase:
    *   `VITE_FIREBASE_API_KEY`
    *   `VITE_FIREBASE_AUTH_DOMAIN`
    *   `VITE_FIREBASE_PROJECT_ID`
    *   `VITE_FIREBASE_STORAGE_BUCKET`
    *   `VITE_FIREBASE_MESSAGING_SENDER_ID`
    *   `VITE_FIREBASE_APP_ID`
    *   `VITE_FIREBASE_DATABASE_ID` (Geralmente `(default)`)

## Segurança

O arquivo `firebase-applet-config.json` e o arquivo `.env` estão no `.gitignore` e **não** são enviados para o GitHub para proteger suas credenciais.

## Scripts Disponíveis

*   `npm run dev`: Inicia o servidor de desenvolvimento.
*   `npm run build`: Gera a versão de produção na pasta `dist`.
*   `npm run lint`: Executa a verificação de código.
