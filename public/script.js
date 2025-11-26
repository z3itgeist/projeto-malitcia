// Seleciona o formulário pelo ID
const formulario = document.getElementById("cadastro");

// Adiciona um "ouvinte" para quando o botão de enviar for clicado
formulario.addEventListener("submit", async (event) => {
    // 1. Impede que a página recarregue sozinha (comportamento padrão do HTML)
    event.preventDefault();

    // 2. Captura os dados digitados nos campos
    const nome = document.getElementById('name').value;
    const nasc = document.getElementById('dateOfBirth').value;
    const doc = document.getElementById('docNumber').value;
    const email = document.getElementById('email').value;
    const tel = document.getElementById('phone').value;

    // 3. Prepara o pacote de dados
    const dadosCliente = {
        nome: nome,
        nasc: nasc,
        doc: doc,
        email: email,
        tel: tel
    };

    // Seleciona a div de mensagem para dar feedback visual
    const divMensagem = document.getElementById('mensagemStatus');
    divMensagem.style.display = 'block';
    divMensagem.innerText = "Enviando dados...";
    divMensagem.className = 'alert alert-info'; // Estilo azul do Bootstrap

    try {
        // 4. Envia os dados para o servidor (Rota /cadastro no server.js)
        const resposta = await fetch('/cadastro', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dadosCliente)
        });

        // 5. Verifica se deu certo
        if (resposta.ok) {
            const textoResposta = await resposta.text();
            divMensagem.innerText = textoResposta; // "Cadastro salvo com sucesso!"
            divMensagem.className = 'alert alert-success'; // Estilo verde
            
            // Limpa o formulário para o próximo cadastro
            formulario.reset();
        } else {
            const erroTexto = await resposta.text();
            divMensagem.innerText = "Erro: " + erroTexto;
            divMensagem.className = 'alert alert-danger'; // Estilo vermelho
        }

    } catch (erro) {
        console.error(erro);
        divMensagem.innerText = "Erro de conexão com o servidor.";
        divMensagem.className = 'alert alert-danger';
    }
});