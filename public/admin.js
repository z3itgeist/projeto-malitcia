// Verifica se está logado antes de tudo
if (!localStorage.getItem('adminLogado')) {
    window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
});

async function carregarDados() {
    try {
        // 1. Busca os DADOS GERAIS do Dashboard (Totais)
        const resDash = await fetch('/dashboard-dados');
        const dadosDash = await resDash.json();

        // Atualiza os números na tela
        document.getElementById('dashTotalClientes').innerText = dadosDash.totalClientes;
        document.getElementById('dashNiverMes').innerText = dadosDash.aniversariantesMes;
        document.getElementById('dashCuponsUsados').innerText = dadosDash.cuponsUsados;

        // 2. Busca a LISTA da semana para a tabela
        const resLista = await fetch('/aniversariantes-semana');
        const listaSemana = await resLista.json();
        
        preencherTabela(listaSemana);

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
    }
}

function preencherTabela(clientes) {
    const tabela = document.getElementById('tabelaCorpo');
    tabela.innerHTML = '';

    if (clientes.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum aniversariante nesta semana.</td></tr>';
        return;
    }

    // Variável global para guardar os dados atuais
    window.listaClientesAtual = clientes;

    clientes.forEach((cliente, index) => {
        const linha = document.createElement('tr');
        
        // Data bonita
        const dataFormatada = new Date(cliente.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        linha.innerHTML = `
            <td>
                <div class="fw-bold">${cliente.nome}</div>
                <small class="text-muted">${cliente.email || ''}</small>
            </td>
            <td>${dataFormatada}</td>
            <td>${cliente.telefone}</td>
            <td>
                <input type="number" class="form-control form-control-sm input-desconto" 
                       data-index="${index}" value="15" style="width: 70px;">
            </td>
            <td>
                <button class="btn btn-success btn-sm" onclick="prepararEnvio(${index})">
                    <i class="bi bi-whatsapp"></i> Enviar
                </button>
            </td>
        `;
        tabela.appendChild(linha);
    });
}

// Função simulada de envio (vamos conectar ao WhatsApp real na próxima etapa)
async function prepararEnvio(index) {
    const cliente = window.listaClientesAtual[index];
    const desconto = document.querySelectorAll('.input-desconto')[index].value;
    const template = document.getElementById('textoPadrao').value;

    // Gera o código localmente ou chama o servidor
    const primeiroNome = cliente.nome.split(' ')[0].toUpperCase();
    const codigoCupom = `NIVER${desconto}_${primeiroNome}`;

    // Substitui o texto
    const mensagem = template
        .replace('{nome}', cliente.nome)
        .replace('{desconto}', desconto)
        .replace('{cupom}', codigoCupom);

    // Aqui vamos abrir o WhatsApp... (Parte 3)
    alert(`Mensagem pronta para ${cliente.nome}:\n\n${mensagem}`);
    
    // Opcional: Salvar que o cupom foi gerado no banco de dados
    await fetch('/registrar-cupom', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ codigo: codigoCupom, valor: desconto, status: 'ativo' })
    });
}