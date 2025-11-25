function cadastro (nome, nasc, doc, email, tel){
    const cliente = {nome, nasc, doc, email, tel};
    fetch('http://localhost:3000/cadastroCliente', {

        method:'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(cliente)
    }) .then ((respostaDoServidor) => {
        return respostaDoServidor.text();
    }) .then((textoFinal) =>{
        const divMensagem = document.getElementById('mensagemStatus')

        divMensagem.innerText = textoFinal;
    })
}   


const formulario = document.getElementById("cadastro");
formulario.addEventListener("submit", (event) => {
    event.preventDefault();

    const nameForm = document.getElementById('name').value;
    const dateForm = document.getElementById('dateOfBirth').value;
    const docForm = document.getElementById('docNumber').value;
    const emailForm = document.getElementById('email').value;
    const phoneForm = document.getElementById('phone').value;

    cadastro(nameForm,dateForm,docForm,emailForm,phoneForm);

})