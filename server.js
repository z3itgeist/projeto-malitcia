require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();

// ==========================================
// 1. CONFIGURAÇÕES INICIAIS
// ==========================================
app.use(cors());
app.use(express.json());

// Configura o servidor para entregar os arquivos da pasta 'public' (HTML, CSS, JS)
const caminhoPublico = path.join(__dirname, 'public');
app.use(express.static(caminhoPublico));

// Conexão com o Supabase
const supabaseUrl = 'https://umypodkvccgvlqvysrum.supabase.co'; 
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);


// ==========================================
// 2. ROTAS DO DASHBOARD (MÉTRICAS)
// ==========================================

// Rota: Busca os números para os cards do topo (Total, Mês, Usados)
app.get('/dashboard-dados', async (req, res) => {
    try {
        // A. Total de Clientes
        // { count: 'exact', head: true } -> Pede só a contagem, sem baixar os dados (mais rápido)
        const { count: totalClientes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        // B. Total de Cupons Usados
        const { count: cuponsUsados } = await supabase
            .from('cupons')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'usado');

        // C. Aniversariantes do Mês Atual
        // Baixamos apenas as datas de nascimento para filtrar no JavaScript
        const { data: todosClientes } = await supabase
            .from('clientes')
            .select('data_nascimento');
            
        const mesAtual = new Date().getMonth(); // 0 (Jan) a 11 (Dez)
        
        // Filtra: Quantos nasceram neste mês?
        const niverMes = todosClientes ? todosClientes.filter(c => {
            if (!c.data_nascimento) return false;
            // A data vem 'YYYY-MM-DD'. O split('-')[1] pega o mês. -1 ajusta para index 0-11
            const mesNasc = parseInt(c.data_nascimento.split('-')[1]) - 1; 
            return mesNasc === mesAtual;
        }).length : 0;

        // Retorna o pacote completo para o admin.js
        res.json({
            totalClientes: totalClientes || 0,
            cuponsUsados: cuponsUsados || 0,
            aniversariantesMes: niverMes
        });

    } catch (error) {
        console.error("Erro no Dashboard:", error);
        res.status(500).json({ erro: "Erro ao carregar métricas" });
    }
});

// Rota: Registrar histórico de cupom gerado
app.post('/registrar-cupom', async (req, res) => {
    const { codigo, valor, status } = req.body;
    
    // Insere na tabela 'cupons'
    const { error } = await supabase
        .from('cupons')
        .insert([{ codigo, valor, status }]);

    if (error) {
        console.error("Erro ao registrar cupom:", error);
        return res.status(500).send("Erro");
    }
    res.sendStatus(200);
});


// ==========================================
// 3. ROTAS DE AUTENTICAÇÃO E CADASTRO
// ==========================================

// Rota: Login do Admin
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    // Verifica na tabela 'admins'
    const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .eq('senha', senha)
        .single();

    if (error || !data) {
        return res.status(401).json({ mensagem: 'Email ou senha incorretos.' });
    }
    res.status(200).json({ mensagem: 'Login OK', nome: data.email });
});

// Rota: Cadastro de Clientes (Formulário Público)
app.post('/cadastro', async (req, res) => {
    const dadosCliente = req.body;
    
    const { error } = await supabase
        .from('clientes')
        .insert([{ 
                nome: dadosCliente.nome,
                data_nascimento: dadosCliente.nasc,
                documento: dadosCliente.doc,
                email: dadosCliente.email,
                telefone: dadosCliente.tel
        }]);

    if (error) {
        res.status(500).send("Erro: " + error.message);
    } else {
        res.status(200).send("Cadastro salvo com sucesso!");
    }
});


// ==========================================
// 4. ROTA DE FILTRO DE ANIVERSARIANTES
// ==========================================

// Rota: Busca Aniversariantes da SEMANA (Para a tabela do Admin)
app.get('/aniversariantes-semana', async (req, res) => {
    const { data: listaClientes, error } = await supabase
        .from('clientes')
        .select('nome, data_nascimento, telefone, email');

    if (error) return res.status(500).send(error.message);

    const hoje = new Date();
    const diaDaSemana = hoje.getDay(); // 0 (Dom) a 6 (Sab)
    
    // Calcula Domingo (Início da semana)
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaDaSemana);
    inicioSemana.setHours(0, 0, 0, 0);

    // Calcula Sábado (Fim da semana)
    const fimSemana = new Date(hoje);
    fimSemana.setDate(hoje.getDate() + (6 - diaDaSemana));
    fimSemana.setHours(23, 59, 59, 999);

    // Filtra quem faz aniversário entre essas datas (ignorando o ano de nasc)
    const aniversariantes = listaClientes.filter(cliente => {
        if (!cliente.data_nascimento) return false;
        const partesData = cliente.data_nascimento.split('-');
        const aniversarioEsteAno = new Date(hoje.getFullYear(), partesData[1] - 1, partesData[2]);
        return aniversarioEsteAno >= inicioSemana && aniversarioEsteAno <= fimSemana;
    });

    res.json(aniversariantes);
});


// ==========================================
// 5. INICIALIZAÇÃO DO SERVIDOR
// ==========================================

// Rota Padrão (Fallback): Se acessar a raiz, entrega o login (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(caminhoPublico, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});