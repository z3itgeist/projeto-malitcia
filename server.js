require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const bcrypt = require('bcrypt');

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
const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);


// ROTA NOVA: Registrar Admin (Protegida por Master Key)
app.post('/registrar-admin', async (req, res) => {
    const { email, senha, tokenMestre } = req.body;

    // 1. Verifica se quem está tentando criar tem a chave do dono (definida no .env)
    if (tokenMestre !== process.env.MASTER_KEY) {
        return res.status(403).send("Chave Mestra incorreta. Acesso negado.");
    }

    try {
        // 2. Criptografa a senha (Hash com custo 10)
        // Isso transforma "123456" em algo como "$2b$10$..."
        const hashedPassword = await bcrypt.hash(senha, 10);

        // 3. Salva no banco (Email + Hash)
        const { error } = await supabase
            .from('admins')
            .insert([{ email: email, senha: hashedPassword }]);

        if (error) throw error;

        res.status(200).send("Admin criado com sucesso! Agora você pode logar.");

    } catch (erro) {
        res.status(500).send("Erro ao criar admin: " + erro.message);
    }
});

// ==========================================
// 2. ROTAS DE GESTÃO DE CLIENTES
// ==========================================

// Rota: Buscar TODOS os clientes (usada na página clientes.html)
app.get('/todos-clientes', async (req, res) => {
    const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

    if (error) return res.status(500).send(error.message);
    res.json(data);
});

// NOVA ROTA: Atualizar dados do cliente (O que faltava!)
app.put('/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const dados = req.body;

    // Atualiza no Supabase
    const { error } = await supabase
        .from('clientes')
        .update({
            nome: dados.nome,
            data_nascimento: dados.data_nascimento,
            telefone: dados.telefone,
            email: dados.email,
            documento: dados.documento
        })
        .eq('id', id);

    if (error) return res.status(500).send("Erro ao atualizar: " + error.message);
    res.sendStatus(200);
});

// Rota: Excluir Cliente
app.delete('/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) return res.status(500).send("Erro ao excluir");
    res.sendStatus(200);
});


// ==========================================
// 3. ROTAS DO DASHBOARD E CUPONS
// ==========================================

// Dados numéricos do Dashboard
app.get('/dashboard-dados', async (req, res) => {
    try {
        const { count: totalClientes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true });

        const { count: cuponsUsados } = await supabase
            .from('cupons')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'usado');

        const { data: todosClientes } = await supabase
            .from('clientes')
            .select('data_nascimento');
            
        const mesAtual = new Date().getMonth(); 
        const niverMes = todosClientes ? todosClientes.filter(c => {
            if (!c.data_nascimento) return false;
            const mesNasc = parseInt(c.data_nascimento.split('-')[1]) - 1; 
            return mesNasc === mesAtual;
        }).length : 0;

        res.json({
            totalClientes: totalClientes || 0,
            cuponsUsados: cuponsUsados || 0,
            aniversariantesMes: niverMes
        });
    } catch (error) {
        console.error("Erro Dashboard:", error);
        res.status(500).json({ erro: "Erro ao carregar métricas" });
    }
});

// Aniversariantes da SEMANA (Tabela do Admin)
app.get('/aniversariantes-semana', async (req, res) => {
    const { data: listaClientes, error } = await supabase
        .from('clientes')
        .select('nome, data_nascimento, telefone, email');

    if (error) return res.status(500).send(error.message);

    const hoje = new Date();
    const diaDaSemana = hoje.getDay(); // 0 (Dom) a 6 (Sab)
    
    // Calcula Domingo e Sábado definindo hora como Meio-dia (12h) para evitar bug de fuso
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaDaSemana);
    inicioSemana.setHours(12, 0, 0, 0); 

    const fimSemana = new Date(hoje);
    fimSemana.setDate(hoje.getDate() + (6 - diaDaSemana));
    fimSemana.setHours(12, 0, 0, 0);

    const aniversariantes = listaClientes.filter(cliente => {
        // --- AQUI ESTÁ A CORREÇÃO (BLINDAGEM) ---
        // Se o cliente não tiver data, nome OU telefone, ele é ignorado.
        // Isso impede que o botão de WhatsApp quebre no frontend.
        if (!cliente.data_nascimento || !cliente.nome || !cliente.telefone) {
            return false;
        }
        
        const partesData = cliente.data_nascimento.split('-'); // [YYYY, MM, DD]
        
        // Cria data de aniversário neste ano, também ao meio-dia
        const aniversarioEsteAno = new Date(
            hoje.getFullYear(), 
            partesData[1] - 1, 
            partesData[2],
            12, 0, 0, 0
        );

        // Comparação simples de datas
        return aniversarioEsteAno >= inicioSemana && aniversarioEsteAno <= fimSemana;
    });

    res.json(aniversariantes);
});

// Aniversariantes do MÊS (Página mes.html)
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
            const primeiroNome = cliente.nome.split(' ')[0].toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
            const cupomEncontrado = cupons.find(cup => cup.codigo.endsWith(`_${primeiroNome}`));
            
            return {
                ...cliente,
                cupom: cupomEncontrado || null
            };
        });

        res.json(listaFinal);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Registrar cupom
app.post('/registrar-cupom', async (req, res) => {
    const { codigo, valor, status } = req.body;
    const { error } = await supabase.from('cupons').insert([{ codigo, valor, status }]);
    if (error) return res.status(500).send("Erro");
    res.sendStatus(200);
});

// Consultar cupom (Validador)
app.get('/consultar-cupom/:codigo', async (req, res) => {
    const codigo = req.params.codigo.toUpperCase();
    const { data, error } = await supabase
        .from('cupons')
        .select('*')
        .eq('codigo', codigo)
        .single();

    if (error || !data) return res.status(404).json({ mensagem: 'Não encontrado' });
    res.json(data);
});

// Baixar cupom (Validador)
app.post('/usar-cupom', async (req, res) => {
    const { codigo } = req.body;
    const { error } = await supabase
        .from('cupons')
        .update({ status: 'usado' })
        .eq('codigo', codigo);
    if (error) return res.status(500).json({ erro: 'Erro ao atualizar' });
    res.sendStatus(200);
});


// ==========================================
// 4. AUTENTICAÇÃO E CADASTRO PÚBLICO
// ==========================================

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    // 1. Busca o usuário pelo email
    const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .single();

    // Se não achar o email ou der erro
    if (error || !data) {
        return res.status(401).json({ mensagem: 'Email ou senha incorretos.' });
    }

    // 2. Compara a senha digitada com o Hash salvo no banco
    // bcrypt.compare(senhaDigitada, senhaDoBanco)
    const senhaBate = await bcrypt.compare(senha, data.senha);

    if (!senhaBate) {
        return res.status(401).json({ mensagem: 'Email ou senha incorretos.' });
    }

    // 3. Sucesso
    res.status(200).json({ mensagem: 'Login OK', nome: data.email });
});

app.post('/cadastro', async (req, res) => {
    const dados = req.body;
    const { error } = await supabase.from('clientes').insert([{ 
        nome: dados.nome, data_nascimento: dados.nasc, documento: dados.doc, email: dados.email, telefone: dados.tel
    }]);

    if (error) res.status(500).send("Erro: " + error.message);
    else res.status(200).send("Salvo!");
});

// Fallback
app.get('/', (req, res) => {
    res.sendFile(path.join(caminhoPublico, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Rodando na porta ${port}`);
});