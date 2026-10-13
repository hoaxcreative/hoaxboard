// Configuração do Firebase do HOAX BOARD (login com Google + banco de dados da equipe).
// Enquanto apiKey estiver vazio, o app roda em "modo teste": os dados ficam só neste aparelho.
// Esses valores não são senha: quem protege os dados são as regras do firestore.rules.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBOZP_qE4WarcVpyMS4oC-RqplF0Ebt9QA",
  authDomain: "hoax-board.firebaseapp.com",
  projectId: "hoax-board",
  storageBucket: "hoax-board.firebasestorage.app",
  messagingSenderId: "560104014065",
  appId: "1:560104014065:web:6b8f5c9be5f07c0ffba950"
};

// Conta Google da dona do board. Ela entra como administradora e cadastra o resto da equipe.
// Precisa ser o mesmo e-mail escrito no firestore.rules.
window.HOAX_DONO = "victoria.hoax@gmail.com";

// Chave das notificações (Firebase › Configurações do projeto › Cloud Messaging › Certificados push da Web).
window.FIREBASE_VAPID_KEY = "";
