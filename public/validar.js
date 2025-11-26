async function buscarCupom(event) {
    event.preventDefault();
    
    const codigoInput = document.getElementById('codigoCupom');
    const codigo = codigoInput.value.trim().toUpperCase();
    const divResultado = document.getElementById('resultado');

    // Feedback visual de carregamento
    divResultado.style.display = 'block';
    divResultado.innerHTML = '<div class="spinner-border text-danger" role="status"></div><p>Verificando...</p>';

    try {
        // 1. Chama o servidor para consultar
        const resposta = await fetch(`/consultar-cupom/${codigo}`);
        const dados = await resposta.json();

        if (resposta.status === 404) {
            // Cupom não existe
            divResultado.innerHTML = `
                <div class="text-danger">
                    <i class="bi bi-x-circle-fill fs-1"></i>
                    <h5 class="mt-2">Cupom Inválido</h5>
                    <p>Código não encontrado no sistema.</p>
                </div>
            `;
            divResultado.style.borderColor = '#dc3545';
        } else {
            // Cupom encontrado! Vamos ver o status.
            mostrarDetalhesCupom(dados);
        }

    } catch (erro) {
        console.error(erro);
        divResultado.innerHTML = '<p class="text-danger">Erro de conexão.</p>';
    }
}

function mostrarDetalhesCupom(cupom) {
    const divResultado = document.getElementById('resultado');
    
    if (cupom.status === 'usado') {
        // Cupom JÁ USADO (Alerta Vermelho)
        divResultado.style.borderColor = '#dc3545';
        divResultado.innerHTML = `
            <div class="status-usado">
                <i class="bi bi-exclamation-triangle-fill fs-1"></i>
                <h4 class="mt-2">JÁ UTILIZADO!</h4>
                <p>Este cupom já foi baixado anteriormente.</p>
                <hr>
                <small>Valor original: ${cupom.valor}%</small>
            </div>
        `;
    } else {
        // Cupom VÁLIDO (Verde)
        divResultado.style.borderColor = '#198754';
        divResultado.innerHTML = `
            <div class="text-success">
                <i class="bi bi-check-circle-fill fs-1"></i>
                <h5 class="mt-2 text-dark">Cupom Válido!</h5>
                <div class="desconto-gigante">${cupom.valor}% OFF</div>
                <p class="text-muted mb-4">Código: <strong>${cupom.codigo}</strong></p>
                
                <button onclick="baixarCupom('${cupom.codigo}')" class="btn btn-success w-100 btn-lg">
                    CONFIRMAR USO (BAIXAR)
                </button>
            </div>
        `;
    }
}

async function baixarCupom(codigo) {
    if (!confirm(`Tem certeza que deseja validar o uso do cupom ${codigo}? Essa ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const resposta = await fetch('/usar-cupom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo: codigo })
        });

        if (resposta.ok) {
            alert('SUCESSO! Desconto aplicado e cupom baixado.');
            // Limpa a tela para o próximo
            document.getElementById('codigoCupom').value = '';
            document.getElementById('resultado').style.display = 'none';
        } else {
            alert('Erro ao baixar cupom.');
        }
    } catch (erro) {
        alert('Erro de conexão.');
    }
}