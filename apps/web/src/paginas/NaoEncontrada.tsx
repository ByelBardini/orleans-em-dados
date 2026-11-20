// O endereço não é página do painel. O servidor responde 404 e o head diz `noindex`; aqui, o caminho de volta.
export default function NaoEncontrada() {
  return (
    <section className="nao-encontrada">
      <h1>Página não encontrada</h1>
      <p>O endereço não corresponde a nenhuma página do Orleans em Dados. Ele pode ter mudado ou estar incompleto.</p>
      <p>
        <a href="/" className="botao-link">
          Voltar ao início
        </a>
      </p>
    </section>
  );
}
