require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();

// 1. CONFIGURAÇÕES
app.use(cors());
app.use(express.json());
const caminhoPublico = path.join(__dirname, 'public');
app.use(express.static(caminhoPublico));

// Conexão Supabase
const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);


// ==========================================
// 1. ROTAS DE SEGURANÇA (ADMINS)
// ==========================================

// Registrar Admin (Protegida por Master Key)
app.post('/registrar-admin', async (req, res) => {
    const { email, senha, tokenMestre } = req.body;

    if (tokenMestre !== process.env.MASTER_KEY) {
        return res.status(403).send("Chave Mestra incorreta. Acesso negado.");
    }

    try {
        const hashedPassword = await bcrypt.hash(senha, 10);
        const { error } = await supabase
            .from('admins')
            .insert([{ email: email, senha: hashedPassword }]);

        if (error) throw error;
        res.status(200).send("Admin criado com sucesso! Agora você pode logar.");
    } catch (erro) {
        res.status(500).send("Erro ao criar admin: " + erro.message);
    }
});

// Login Seguro (Compara Hash)
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !data) {
        return res.status(401).json({ mensagem: 'Email ou senha incorretos.' });
    }

    const senhaBate = await bcrypt.compare(senha, data.senha);

    if (!senhaBate) {
        return res.status(401).json({ mensagem: 'Email ou senha incorretos.' });
    }

    res.status(200).json({ mensagem: 'Login OK', nome: data.email });
});


// ==========================================
// 2. ROTAS GERAIS (ANIVERSARIANTES, CUPONS, CLIENTES)
// ==========================================

// Aniversariantes Semana (Blindado)
app.get('/aniversariantes-semana', async (req, res) => {
    const { data: listaClientes, error } = await supabase
        .from('clientes').select('nome, data_nascimento, telefone, email');
    if (error) return res.status(500).send(error.message);

    const hoje = new Date();
    const diaDaSemana = hoje.getDay();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaDaSemana);
    inicioSemana.setHours(12, 0, 0, 0); 
    const fimSemana = new Date(hoje);
    fimSemana.setDate(hoje.getDate() + (6 - diaDaSemana));
    fimSemana.setHours(12, 0, 0, 0);

    const aniversariantes = listaClientes.filter(cliente => {
        if (!cliente.data_nascimento || !cliente.nome || !cliente.telefone) return false;
        
        cliente.telefone = String(cliente.telefone);
        cliente.nome = String(cliente.nome);
        const partesData = cliente.data_nascimento.split('-');
        if (partesData.length !== 3) return false;
        
        const aniversarioEsteAno = new Date(hoje.getFullYear(), partesData[1] - 1, partesData[2], 12, 0, 0, 0);
        return aniversarioEsteAno >= inicioSemana && aniversarioEsteAno <= fimSemana;
    });
    res.json(aniversariantes);
});

// Dashboard
app.get('/dashboard-dados', async (req, res) => {
    try {
        const { count: totalClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
        const { count: cuponsUsados } = await supabase.from('cupons').select('*', { count: 'exact', head: true }).eq('status', 'usado');
        const { data: todosClientes } = await supabase.from('clientes').select('data_nascimento');
        const mesAtual = new Date().getMonth(); 
        const niverMes = todosClientes ? todosClientes.filter(c => {
            if (!c.data_nascimento) return false;
            const mesNasc = parseInt(c.data_nascimento.split('-')[1]) - 1; 
            return mesNasc === mesAtual;
        }).length : 0;

        res.json({ totalClientes: totalClientes || 0, cuponsUsados: cuponsUsados || 0, aniversariantesMes: niverMes });
    } catch (error) { res.status(500).json({ erro: "Erro" }); }
});

// Gestão Clientes (Listar, Um, Editar, Apagar)
app.get('/todos-clientes', async (req, res) => {
    const { data, error } = await supabase.from('clientes').select('*').order('nome', { ascending: true });
    if (error) return res.status(500).send(error.message);
    res.json(data);
});
app.get('/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
    if (error) return res.status(404).send("Não encontrado");
    res.json(data);
});
app.put('/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const dados = req.body;
    const { error } = await supabase.from('clientes').update({
        nome: dados.nome, data_nascimento: dados.data_nascimento, telefone: dados.telefone, email: dados.email, documento: dados.documento
    }).eq('id', id);
    if (error) return res.status(500).send("Erro: " + error.message);
    res.sendStatus(200);
});
app.delete('/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) return res.status(500).send("Erro");
    res.sendStatus(200);
});

// =========================================================
// ROTA ALTERADA: Mês Detalhado (Busca com Sobrenome)
// =========================================================
app.get('/aniversariantes-mes-detalhado', async (req, res) => {
    try {
        const { data: clientes } = await supabase.from('clientes').select('*');
        const { data: cupons } = await supabase.from('cupons').select('*');
        const mesAtual = new Date().getMonth();
        
        const listaMes = clientes.filter(c => {
            if (!c.data_nascimento) return false;
            const mesNasc = parseInt(c.data_nascimento.split('-')[1]) - 1;
            return mesNasc === mesAtual;
        });

        const listaFinal = listaMes.map(cliente => {
            // Limpa o nome para padronizar (Maiúsculo, sem acento)
            const nomeSeguro = cliente.nome ? String(cliente.nome).trim() : "CLIENTE";
            const partesNome = nomeSeguro.split(/\s+/);
            
            const primeiroNome = partesNome[0].toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
            
            // Tenta pegar o último nome também
            let ultimoNome = "";
            if (partesNome.length > 1) {
                ultimoNome = partesNome[partesNome.length - 1].toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
            }

            // === A MÁGICA AQUI ===
            // Procura o cupom tentando casar com o padrão NOVO (_PRIMEIRO_ULTIMO)
            // Se não achar, tenta casar com o padrão ANTIGO (_PRIMEIRO)
            const cupomEncontrado = cupons.find(cup => {
                // Tenta achar NIVERXX_PRIMEIRO_ULTIMO
                if (ultimoNome && cup.codigo.endsWith(`_${primeiroNome}_${ultimoNome}`)) {
                    return true;
                }
                // Tenta achar NIVERXX_PRIMEIRO (compatibilidade)
                return cup.codigo.endsWith(`_${primeiroNome}`);
            });

            return { ...cliente, cupom: cupomEncontrado || null };
        });
        res.json(listaFinal);
    } catch (e) { res.status(500).send(e.message); }
});

// Cupons e Validação
app.post('/registrar-cupom', async (req, res) => {
    const { codigo, valor, status } = req.body;
    const { error } = await supabase.from('cupons').insert([{ codigo, valor, status }]);
    if (error) console.error("ERRO CUPOM:", error);
    if (error) return res.status(500).send("Erro");
    res.sendStatus(200);
});

app.get('/consultar-cupom/:codigo', async (req, res) => {
    const codigo = req.params.codigo.toUpperCase();
    const { data, error } = await supabase.from('cupons').select('*').eq('codigo', codigo).single();
    if (error || !data) return res.status(404).json({ mensagem: 'Não encontrado' });
    res.json(data);
});

app.post('/usar-cupom', async (req, res) => {
    const { codigo } = req.body;
    const { error } = await supabase.from('cupons').update({ status: 'usado' }).eq('codigo', codigo);
    if (error) return res.status(500).json({ erro: 'Erro' });
    res.sendStatus(200);
});

// Cadastro Público
app.post('/cadastro', async (req, res) => {
    const dados = req.body;
    const { error } = await supabase.from('clientes').insert([{ 
        nome: dados.nome, data_nascimento: dados.nasc, documento: dados.doc, email: dados.email, telefone: dados.tel
    }]);
    if (error) res.status(500).send("Erro: " + error.message);
    else res.status(200).send("Salvo!");
});

app.get('/', (req, res) => {
    res.sendFile(path.join(caminhoPublico, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Rodando na porta ${port}`);
});