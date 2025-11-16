//imports do projeto
require('dotenv').config(); 
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const fs = require('fs');
const cors = require('cors');

//primeiras chamadas pra iniciar o express
const app = express();
app.use(express.json());
app.use(cors());

//config do cliente do supabase
const supabaseUrl = 'https://umypodkvccgvlqvysrum.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

app.listen(3000, () => {
    console.log('Servidor ligado! Ouvindo na porta 3000')
});



app.post('/cadastroCliente',(request, response) =>{

    const dadosDoCliente = request.body;
    const dadosParaSalvar = JSON.stringify(dadosDoCliente)+'\n';
    fs.appendFile('cadastros.txt', dadosParaSalvar, (err) =>{
        if(err){
            console.log(err);
            response.send('Erro ao salvar cadastro.');
        } else {
            console.log('Cadastro completado normalmente.')
            response.send('Cadastro finalizado!');
        }
    })
} )