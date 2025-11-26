// 1. VERIFICAÇÃO DE SEGURANÇA
// Se não tiver o "crachá" de login no navegador, chuta de volta pra tela de login
if (!localStorage.getItem('adminLogado')) {
    window.location.href = '/';
}

// Quando a página carregar, puxa os dados
document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
});

// Variável global para guardar a lista de clientes que está na tela
// Isso ajuda a saber quem é quem na hora de clicar no botão "Enviar"
window.listaClientesAtual = [];

async function carregarDados() {
    try {
        // --- PARTE A: CARREGA OS NÚMEROS DO TOPO (CARDS) ---
        const resDash = await fetch('/dashboard-dados');
        const dadosDash = await resDash.json();

        // Preenche os números na tela
        document.getElementById('dashTotalClientes').innerText = dadosDash.totalClientes;
        document.getElementById('dashNiverMes').innerText = dadosDash.aniversariantesMes;
        document.getElementById('dashCuponsUsados').innerText = dadosDash.cuponsUsados;

        // --- PARTE B: CARREGA A TABELA DA SEMANA ---
        const resLista = await fetch('/aniversariantes-semana');
        const listaSemana = await resLista.json();
        
        preencherTabela(listaSemana);

    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
        // Não usamos alert aqui para não travar a tela se falhar algo pequeno
        document.getElementById('tabelaCorpo').innerHTML = '<tr><td colspan="5" class="text-danger text-center">Erro ao conectar com o servidor.</td></tr>';
    }
}

function preencherTabela(clientes) {
    const tabela = document.getElementById('tabelaCorpo');
    tabela.innerHTML = ''; // Limpa a tabela antes de encher

    if (clientes.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">Nenhum aniversariante encontrado nesta semana. 🎂</td></tr>';
        return;
    }

    // Salva a lista na memória global
    window.listaClientesAtual = clientes;

    // Cria uma linha (tr) para cada cliente
    clientes.forEach((cliente, index) => {
        const linha = document.createElement('tr');
        
        // Formata a data para o padrão Brasileiro (DD/MM/AAAA)
        // O 'UTC' é importante para a data não "voltar" um dia por causa do fuso horário
        const dataFormatada = new Date(cliente.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        linha.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${cliente.nome}</div>
                <small class="text-muted" style="font-size: 0.85em;">${cliente.email || 'Sem e-mail'}</small>
            </td>
            <td>${dataFormatada}</td>
            <td>${cliente.telefone}</td>
            <td>
                <!-- Campo de input para você digitar o desconto na hora (padrão 15) -->
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control input-desconto" 
                           data-index="${index}" value="15" style="max-width: 60px;">
                    <span class="input-group-text">%</span>
                </div>
            </td>
            <td>
                <!-- Botão que chama a função de envio -->
                <button class="btn btn-success btn-sm btn-envio" onclick="prepararEnvio(${index})">
                    <i class="bi bi-whatsapp"></i> Enviar
                </button>
            </td>
        `;
        tabela.appendChild(linha);
    });
}

// --- A MÁGICA DO WHATSAPP ---
async function prepararEnvio(index) {
    // Pega o cliente específico baseado no botão clicado
    const cliente = window.listaClientesAtual[index];
    const btn = document.querySelectorAll('.btn-envio')[index];
    
    // 1. Pega os valores da tela
    const inputDesconto = document.querySelectorAll('.input-desconto')[index];
    const desconto = inputDesconto.value;
    const template = document.getElementById('textoPadrao').value;

    // 2. Gera um código de cupom ÚNICO
    // Pega o primeiro nome, converte pra maiúsculo e remove acentos/símbolos
    // Ex: "João Silva" -> "JOAO"
    const primeiroNome = cliente.nome.split(' ')[0].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "");
    
    // Ex: NIVER15_JOAO
    const codigoCupom = `NIVER${desconto}_${primeiroNome}`;

    // 3. Substitui as variáveis no texto padrão
    const mensagem = template
        .replace(/{nome}/g, cliente.nome.split(' ')[0]) // Usa só o primeiro nome na msg (mais pessoal)
        .replace(/{desconto}/g, desconto)
        .replace(/{cupom}/g, codigoCupom);

    // 4. Limpa o telefone para o padrão do WhatsApp (apenas números)
    let telefoneLimpo = cliente.telefone.replace(/\D/g, '');
    
    // Correção inteligente de DDI: Se o número tem 10 ou 11 dígitos (ex: 11999998888),
    // assumimos que é Brasil e adicionamos o 55 na frente.
    if (telefoneLimpo.length >= 10 && telefoneLimpo.length <= 11) {
        telefoneLimpo = '55' + telefoneLimpo;
    }

    // 5. Feedback visual: mostra que está processando
    const textoOriginalBtn = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Gerando...';
    btn.disabled = true;
    
    try {
        // 6. Tenta salvar o cupom no banco de dados
        await fetch('/registrar-cupom', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                codigo: codigoCupom, 
                valor: desconto, 
                status: 'ativo' 
            })
        });

        // 7. Codifica a mensagem para URL (transforma espaços em %20, quebras de linha, etc)
        const textoCodificado = encodeURIComponent(mensagem);
        
        // 8. Cria o link do WhatsApp
        // wa.me abre o app se estiver no celular, ou o site se estiver no PC
        const linkZap = `https://wa.me/${telefoneLimpo}?text=${textoCodificado}`;
        
        // Abre em nova aba
        window.open(linkZap, '_blank');

        // Atualiza o botão para "Sucesso"
        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Enviado';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-secondary'); // Muda pra cinza pra indicar que já foi

    } catch (erro) {
        console.error(erro);
        alert("Erro ao registrar cupom no sistema. Tente novamente.");
        // Se der erro, volta o botão ao normal
        btn.disabled = false;
        btn.innerHTML = textoOriginalBtn;
    }
}