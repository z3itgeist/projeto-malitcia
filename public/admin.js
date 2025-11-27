if (!localStorage.getItem('adminLogado')) {
    window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
});

window.listaClientesAtual = [];

// --- CARREGAMENTO DE DADOS PRINCIPAIS ---
async function carregarDados() {
    // Feedback visual no botão atualizar
    const btnAtualizar = document.querySelector('button[onclick="carregarDados()"]');
    let textoOriginal = '';
    
    if (btnAtualizar) {
        textoOriginal = btnAtualizar.innerHTML;
        btnAtualizar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Atualizando...';
        btnAtualizar.disabled = true;
    }

    try {
        // TRUQUE ANTI-CACHE: ?t=TIMESTAMP
        const timestamp = new Date().getTime();

        const resDash = await fetch(`/dashboard-dados?t=${timestamp}`);
        const dadosDash = await resDash.json();

        document.getElementById('dashTotalClientes').innerText = dadosDash.totalClientes;
        document.getElementById('dashNiverMes').innerText = dadosDash.aniversariantesMes;
        document.getElementById('dashCuponsUsados').innerText = dadosDash.cuponsUsados;

        const resLista = await fetch(`/aniversariantes-semana?t=${timestamp}`);
        const listaSemana = await resLista.json();
        
        preencherTabela(listaSemana);

    } catch (erro) {
        console.error("Erro dashboard:", erro);
        document.getElementById('tabelaCorpo').innerHTML = '<tr><td colspan="5" class="text-danger text-center">Erro ao conectar com o servidor.</td></tr>';
    } finally {
        if (btnAtualizar) {
            btnAtualizar.innerHTML = textoOriginal;
            btnAtualizar.disabled = false;
        }
    }
}

function preencherTabela(clientes) {
    const tabela = document.getElementById('tabelaCorpo');
    tabela.innerHTML = '';
    
    const btnEnviarTodos = document.getElementById('btnEnviarTodos');
    if (btnEnviarTodos) {
        btnEnviarTodos.disabled = (clientes.length === 0);
    }
    
    const aviso = document.getElementById('avisoPopups');
    if (aviso) aviso.style.display = 'none';

    if (clientes.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">Nenhum aniversariante encontrado nesta semana.</td></tr>';
        return;
    }

    window.listaClientesAtual = clientes;

    clientes.forEach((cliente, index) => {
        const linha = document.createElement('tr');
        // Proteção para data
        let dataFormatada = '-';
        if (cliente.data_nascimento) {
            dataFormatada = new Date(cliente.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }

        linha.innerHTML = `
            <td>
                <div class="fw-bold">${cliente.nome}</div>
                <small class="text-muted">${cliente.email || ''}</small>
            </td>
            <td>${dataFormatada}</td>
            <td>${cliente.telefone}</td>
            <td>
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control input-desconto" 
                           data-index="${index}" value="15" style="max-width: 60px;">
                    <span class="input-group-text">%</span>
                </div>
            </td>
            <td>
                <button class="btn btn-success btn-sm btn-envio" onclick="enviarUnico(${index})">
                    <i class="bi bi-whatsapp"></i> Enviar
                </button>
            </td>
        `;
        tabela.appendChild(linha);
    });
}

// --- FUNÇÕES DE ENVIO ---

async function enviarUnico(index) {
    const btn = document.querySelectorAll('.btn-envio')[index];
    if (btn.classList.contains('btn-secondary')) return;

    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ...';
    
    try {
        await processarEnvio(index);
        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Enviado';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-secondary');
    } catch (erro) {
        console.error(erro);
        alert("Erro ao processar envio: " + erro.message);
        btn.innerHTML = '<i class="bi bi-whatsapp"></i> Tentar Novamente';
        btn.classList.add('btn-success');
    }
}

async function enviarTodos() {
    const total = window.listaClientesAtual.length;
    if (total === 0) return;

    if (!confirm(`Você vai iniciar o envio para ${total} clientes.\n\nIMPORTANTE: Verifique o bloqueador de pop-ups.`)) {
        return;
    }

    const aviso = document.getElementById('avisoPopups');
    if (aviso) aviso.style.display = 'block';

    const statusDiv = document.getElementById('statusEnvioEmMassa');
    if (statusDiv) statusDiv.style.display = 'block';

    const botoes = document.querySelectorAll('.btn-envio');

    for (let i = 0; i < total; i++) {
        if (botoes[i].classList.contains('btn-secondary')) continue;

        if (statusDiv) statusDiv.innerText = `Processando ${i + 1} de ${total}... (Mantenha a aba aberta)`;
        botoes[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        await enviarUnico(i);
        await new Promise(r => setTimeout(r, 2000));
    }

    if (statusDiv) statusDiv.innerText = "Processo finalizado!";
    alert("Envio em massa concluído!");
}

async function processarEnvio(index) {
    const cliente = window.listaClientesAtual[index];
    
    // --- BLINDAGEM CONTRA ERROS DE DADOS ---
    // Converte para String antes de tentar mexer, evitando o crash "replace is not a function"
    const nomeSeguro = String(cliente.nome || 'Cliente');
    const telefoneSeguro = String(cliente.telefone || '');
    // ---------------------------------------

    const inputDesconto = document.querySelectorAll('.input-desconto')[index];
    const desconto = inputDesconto.value;
    const template = document.getElementById('textoPadrao').value;

    const primeiroNome = nomeSeguro.split(' ')[0].toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
    const codigoCupom = `NIVER${desconto}_${primeiroNome}`;

    const mensagem = template
        .replace(/{nome}/g, nomeSeguro.split(' ')[0])
        .replace(/{desconto}/g, desconto)
        .replace(/{cupom}/g, codigoCupom);

    // Agora é seguro usar replace, pois telefoneSeguro é GARANTIDO ser texto
    let telefoneLimpo = telefoneSeguro.replace(/\D/g, '');
    
    if (telefoneLimpo.length >= 10 && telefoneLimpo.length <= 11) {
        telefoneLimpo = '55' + telefoneLimpo;
    }

    if (telefoneLimpo.length < 10) {
        throw new Error("Telefone inválido ou muito curto: " + telefoneSeguro);
    }

    await fetch('/registrar-cupom', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ codigo: codigoCupom, valor: desconto, status: 'ativo' })
    });

    const textoCodificado = encodeURIComponent(mensagem);
    const linkZap = `https://wa.me/${telefoneLimpo}?text=${textoCodificado}`;
    window.open(linkZap, '_blank');
}