const formLogin = document.getElementById('formLogin');
const msgErro = document.getElementById('mensagemErro');

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgErro.style.display = 'none';
    msgErro.innerText = '';

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        const resposta = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const dados = await resposta.json();

        if (resposta.status === 200) {
            // Sucesso!
            // 1. Salva um sinal de que estamos logados (simples)
            localStorage.setItem('adminLogado', 'true');
            localStorage.setItem('adminNome', dados.nome || 'Admin');

            // 2. Redireciona para o painel
            window.location.href = '/admin.html';
        } else {
            // Erro (Senha errada ou usuário não encontrado)
            msgErro.innerText = dados.mensagem || 'Erro ao fazer login.';
            msgErro.style.display = 'block';
        }

    } catch (erro) {
        console.error(erro);
        msgErro.innerText = 'Erro de conexão com o servidor.';
        msgErro.style.display = 'block';
    }
});