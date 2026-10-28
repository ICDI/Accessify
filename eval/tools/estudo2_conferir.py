#!/usr/bin/env python3
"""Confere, ao vivo, se as respostas esperadas das tarefas do Estudo 2 continuam nos sites.

Rodar na véspera de cada sessão (e no dia, antes de começar). Cada checagem exige que os
trechos apareçam NA ORDEM dada, a partir de alguma ocorrência do primeiro trecho, e que o
último termine dentro da janela da checagem (em caracteres, medida sobre o span real mais
uma folga). Modo 'texto' compara o texto visível da página (sem tags); modo 'html', o HTML
cru (para endereços de links sem nome).

Os controles negativos trocam a resposta pela de outra variante ou linha vizinha e precisam
NÃO casar: se um casar, a janela ficou larga demais e um OK deixaria passar resposta errada.

Uso: python3 -I eval/tools/estudo2_conferir.py [--tarefa ID ...]
     ID da tarefa (ex.: CAPES-1) ou da variante (CAPES-1A).
Saída: OK / FALHA / SEM ACESSO por checagem; código 1 se alguma falhar ou não carregar,
2 se o filtro não selecionar nenhuma checagem.

O servidor sol.sbc.org.br recusou conexões por mais de 1 h depois de ~20 carregamentos em
poucos minutos (28/10/2026): o script baixa cada página uma única vez e espera entre pedidos.
Protocolo e tarefas: docs/pesquisa/estudo2_tarefas.md.
"""
import html
import re
import sys
import time
import urllib.error
import urllib.request

PAGINAS = {
    'sol_ihc25': 'https://sol.sbc.org.br/index.php/ihc/issue/view/1582',
    'sol_busca': 'https://sol.sbc.org.br/busca/',
    'books_161': 'https://books-sol.sbc.org.br/index.php/sbc/catalog/book/161',
    'books_155': 'https://books-sol.sbc.org.br/index.php/sbc/catalog/book/155',
    'capes_az_jbcs': 'https://www.periodicos.capes.gov.br/index.php/acervo/lista-a-z-periodicos.html?q=Journal+of+the+Brazilian+Computer+Society',
    'capes_az_jbchs': 'https://www.periodicos.capes.gov.br/index.php/acervo/lista-a-z-periodicos.html?q=Journal+of+the+Brazilian+Chemical+Society',
    'capes_det_jbcs': 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html?task=detalhes&source=resources&id=WJ110978984562091',
    'capes_det_jbchs': 'https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html?task=detalhes&source=resources&id=WJ954925467286',
    'capes_suporte': 'https://www.periodicos.capes.gov.br/index.php/ajuda/suporte-regional.html',
    'capes_valores': 'https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/prestacao-de-contas/valores-de-bolsas',
    'ihc26_home': 'https://ihc.sbc.org.br/2026/',
    'ihc26_prog': 'https://ihc.sbc.org.br/2026/index.php/programacao/',
    'ihc26_sessoes': 'https://ihc.sbc.org.br/2026/index.php/sessoes-tecnicas/',
    'ihc26_local': 'https://ihc.sbc.org.br/2026/index.php/local/',
    'ihc25_premio': 'https://ihc.sbc.org.br/2025/index.php/premio-junia-coutinho-anacleto/',
    'ihc25_posteres': 'https://ihc.sbc.org.br/2025/index.php/posteres-e-demonstracoes/',
    'ihc25_inscricoes': 'https://ihc.sbc.org.br/2025/index.php/inscricoes/',
    'csbc_home': 'https://csbc.sbc.org.br/2026/',
    'csbc_prog': 'https://csbc.sbc.org.br/2026/programacao/',
    'edu_minicursos': 'https://educomp.sbc.org.br/2026/educomp/chamadas/minicursos.html',
    'edu_mesas': 'https://educomp.sbc.org.br/2026/educomp/chamadas/mesas-tematicas.html',
    'edu_comite': 'https://educomp.sbc.org.br/2026/educomp/equipes/comite-programa.html',
    'sbc_associe': 'https://www.sbc.org.br/associe-se/',
    'sbc_secretarias': 'https://www.sbc.org.br/secretarias_regionais/',
    'jis_vol16': 'https://journals-sol.sbc.org.br/index.php/jis/issue/view/volume16',
    'jis_guidelines': 'https://journals-sol.sbc.org.br/index.php/jis/guidelines',
}

SOL_1A = 'Can AI Judge Usability? A Comparative Analysis of Generative Tools on Climate Conference Websites'
SOL_1B = 'Teaching or Manipulating? On the Adoption of Bright and Deceptive Patterns by Duolingo'
IHC_5_SEC = 'Somente Inscrição no IHC'
IHC_5A = 'Profissional associado à SBC com anuidade vigente'
IHC_5B = 'Estudante de pós-graduação associado à SBC com anuidade vigente'

# (id, página, modo, trechos em ordem, janela em caracteres). As janelas de SOL vêm de uma
# cópia do Wayback (22/10/2026); as demais, dos spans medidos ao vivo em 28/10/2026.
CHECAGENS = [
    # Núcleo
    ('SOL-1A', 'sol_ihc25', 'texto', [SOL_1A, 'Danilo Teixeira Lima'], 200),
    ('SOL-1B', 'sol_ihc25', 'texto', [SOL_1B, 'João Vítor Castro'], 200),
    ('SOL-1 busca', 'sol_busca', 'texto', ['Anais de Eventos'], 50),
    ('SOL-2A', 'sol_ihc25', 'texto', ['Relatos de Experiência', 'Falando, desenhando e avaliando'], 700),
    ('SOL-2B', 'sol_ihc25', 'texto', ['Ideias Inovadoras e Resultados Emergentes em IHC', 'Diagnóstico da Acessibilidade Digital em Serviços Públicos Prioritários'], 700),
    ('CAPES-1A busca', 'capes_az_jbcs', 'texto', ['1 resultados', 'Journal of the Brazilian Computer Society'], 700),
    ('CAPES-1A', 'capes_det_jbcs', 'texto', ['ISSN', '0104-6500'], 60),
    ('CAPES-1B busca', 'capes_az_jbchs', 'texto', ['1 resultados', 'JOURNAL OF THE BRAZILIAN CHEMICAL SOCIETY'], 700),
    ('CAPES-1B', 'capes_det_jbchs', 'texto', ['ISSN', '0103-5053'], 60),
    ('CAPES-2A', 'capes_suporte', 'texto', ['Região Centro-Oeste', 'lucianasetubal@unb.br', 'seanio.avelino@unb.br'], 200),
    ('CAPES-2B', 'capes_suporte', 'texto', ['Região Sudeste', 'cref@sibi.ufrj.br'], 120),
    ('IHC-1A', 'ihc26_sessoes', 'texto', ['Sessão Técnica 10', 'Legado Digital e Memória', 'Quinta-feira, 22/10', '08h30 - 10h00', 'Algaroba', 'Explorando lacunas e oportunidades em aplicativos móveis para suporte ao luto'], 900),
    ('IHC-1B', 'ihc26_sessoes', 'texto', ['Sessão Técnica 7', 'Engenharia Semiótica e Comunicabilidade', 'Quarta-feira, 21/10', '14h - 15h30', 'Juazeiro', 'Lições Aprendidas sobre a Comunicabilidade da Ferramenta FAKECHECK'], 850),
    ('IHC-1 menu', 'ihc26_home', 'texto', ['Programação'], 20),
    ('IHC-2A', 'ihc26_prog', 'texto', ['20/10 - Terça', '10h30 – 12h', 'Sessão Técnica 2', 'Diversidade e Justiça Social'], 1000),
    ('IHC-2B', 'ihc26_prog', 'texto', ['21/10 - Quarta', '10h30 – 12h', 'Sessão Técnica 6', 'Padrões Enganosos e Privacidade'], 1080),
    ('CSBC-2A', 'csbc_home', 'html', ['COBRE', 'scherm.com.br', 'alt=""'], 1100),
    ('CSBC-2B', 'csbc_home', 'html', ['OURO', 'qualcomm.com', 'alt=""'], 1600),
    ('EDU-1A', 'edu_minicursos', 'texto', ['Coordenação:', 'Maria Ivanilse Calderon Ribeiro'], 80),
    ('EDU-1B', 'edu_mesas', 'texto', ['Coordenação:', 'Jefferson Rodrigo Speck'], 80),
    # Complementar
    ('SBC-1A', 'sbc_associe', 'texto', ['Estudante de Pós-graduação', 'R$ 142,00'], 850),
    ('SBC-1B', 'sbc_associe', 'texto', ['Efetivo/Fundador', 'R$ 394,00'], 900),
    ('SBC-2A', 'sbc_secretarias', 'texto', ['Pernambuco', 'Kiev Gama'], 40),
    ('SBC-2B', 'sbc_secretarias', 'texto', ['Roraima', 'Herbert Rocha'], 40),
    ('EDU-3A', 'edu_comite', 'texto', ['Trilha 2 - Relatos de experiência', 'Fernanda Pires', 'UEA', 'Luciano Ferreira', 'UFRR'], 150),
    ('EDU-3B', 'edu_comite', 'texto', ['Trilha 4 - Recursos e ambientes educacionais', 'Eduardo Figueiredo', 'UFMG', 'Ronney Castro', 'UFJF'], 160),
    ('JIS-1A', 'jis_vol16', 'texto', ['Kahoot as a data collection tool to work with school age children', '227-235'], 180),
    ('JIS-1B', 'jis_vol16', 'texto', ['Evaluating a Serious Game for Math: Is it Useful and Fun?', '199-212'], 200),
    # Reservas
    ('SOL-4A título', 'books_161', 'texto', ['Minicursos do IHC 2024'], 30),
    ('SOL-4A', 'books_161', 'texto', ['ISBN-13 (15)', '978-85-7669-623-0'], 60),
    ('SOL-4B título', 'books_155', 'texto', ['Minicursos do IHC 2023'], 30),
    ('SOL-4B', 'books_155', 'texto', ['ISBN-13 (15)', '978-85-7669-604-9'], 60),
    ('CAPES-3A', 'capes_valores', 'texto', ['Professor Visitante Sênior', '2.300,00', '2.300,00', '1.900,00', '3.060,00'], 100),
    ('CAPES-3B', 'capes_valores', 'texto', ['Professor Visitante Júnior Pós Doutorado', '2.100,00', '2.100,00', '1.700,00', '2.660,00'], 110),
    ('IHC-3A', 'ihc25_premio', 'texto', ['Programação', 'Dia: 09/09 Terça - Hora: 8:00h'], 80),
    ('IHC-3B', 'ihc25_posteres', 'texto', ['Programação', 'Sessão 1 - Dia: 08/09 Segunda - Hora: 15:30h'], 90),
    ('IHC-4A', 'ihc26_local', 'texto', ['Hotel Pedra dos Ventos', 'Distância para a UFC: 23 km'], 200),
    ('IHC-4B', 'ihc26_local', 'texto', ['Cedro Palace Hotel', 'Distância para UFC: 5,2 km'], 200),
    ('IHC-5A', 'ihc25_inscricoes', 'texto', [IHC_5_SEC, IHC_5A, 'Até 07/07', 'R$ 450,00'], 200),
    ('IHC-5B', 'ihc25_inscricoes', 'texto', [IHC_5_SEC, IHC_5B, 'Até 07/07', 'R$ 290,00'], 1200),
    ('CSBC-1A', 'csbc_prog', 'texto', ['19:00 - 20:00 Cerimônia de Abertura'], 60),
    ('CSBC-1B', 'csbc_prog', 'texto', ['20:00 Jantar do Evento'], 40),
    ('JIS-2A', 'jis_guidelines', 'texto', ['Cover Letter', 'Research highlights: Up to five original contributions'], 700),
    ('JIS-2B', 'jis_guidelines', 'texto', ['Review Process', 'generally reviewed by three independent experts'], 720),
]

# Respostas trocadas que precisam NÃO casar (mesma janela da checagem correspondente).
NEGATIVOS = [
    ('SOL-1A', 'sol_ihc25', 'texto', [SOL_1A, 'George Valença'], 200),
    ('SOL-2A', 'sol_ihc25', 'texto', ['Ideias Inovadoras e Resultados Emergentes em IHC', 'Falando, desenhando e avaliando'], 700),
    ('CAPES-1A', 'capes_det_jbcs', 'texto', ['ISSN', '0103-5053'], 60),
    ('CAPES-2A', 'capes_suporte', 'texto', ['Região Centro-Oeste', 'cref@sibi.ufrj.br'], 200),
    ('CAPES-2B', 'capes_suporte', 'texto', ['Região Sudeste', 'lucianasetubal@unb.br'], 120),
    ('IHC-1A', 'ihc26_sessoes', 'texto', ['Sessão Técnica 10', 'Legado Digital e Memória', 'Quarta-feira, 21/10'], 900),
    ('IHC-1B', 'ihc26_sessoes', 'texto', ['Sessão Técnica 7', 'Engenharia Semiótica e Comunicabilidade', 'Quinta-feira, 22/10'], 850),
    ('IHC-2A', 'ihc26_prog', 'texto', ['20/10 - Terça', '10h30 – 12h', 'Sessão Técnica 6'], 1000),
    ('IHC-2B', 'ihc26_prog', 'texto', ['21/10 - Quarta', '10h30 – 12h', 'Sessão Técnica 2'], 1080),
    ('CSBC-2A', 'csbc_home', 'html', ['COBRE', 'qualcomm.com'], 1100),
    ('EDU-1A', 'edu_minicursos', 'texto', ['Coordenação:', 'Jefferson Rodrigo Speck'], 80),
    ('SBC-1A', 'sbc_associe', 'texto', ['Estudante de Pós-graduação', 'R$ 394,00'], 850),
    ('SBC-2A', 'sbc_secretarias', 'texto', ['Pernambuco', 'Herbert Rocha'], 40),
    ('EDU-3A', 'edu_comite', 'texto', ['Trilha 2 - Relatos de experiência', 'UFMG'], 150),
    ('JIS-1A', 'jis_vol16', 'texto', ['Kahoot as a data collection tool to work with school age children', '199-212'], 180),
    ('IHC-5A', 'ihc25_inscricoes', 'texto', [IHC_5_SEC, IHC_5A, 'Até 07/07', 'R$ 290,00'], 200),
    ('IHC-5B', 'ihc25_inscricoes', 'texto', [IHC_5_SEC, IHC_5B, 'Até 07/07', 'R$ 190,00'], 1200),
    ('CSBC-1A', 'csbc_prog', 'texto', ['18:30 - 19:00 Cerimônia de Abertura'], 60),
]

ESPERA_S = 2.0  # entre pedidos ao mesmo host


def texto_visivel(bruto):
    s = re.sub(r'(?is)<(script|style|noscript)\b.*?</\1>', ' ', bruto)
    s = re.sub(r'<[^>]+>', ' ', s)
    return normalizar(html.unescape(s))


def normalizar(s):
    s = s.replace(' ', ' ').replace(' ', ' ')
    s = re.sub(r'\s+', ' ', s)
    return s.replace(' :', ':').strip()


def baixar(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode(resp.headers.get_content_charset() or 'utf-8', 'ignore')


def casa(alvo, trechos, janela):
    """Algum início do 1º trecho a partir do qual os demais aparecem em ordem dentro da janela."""
    partes = [normalizar(t) for t in trechos]
    inicio = alvo.find(partes[0])
    while inicio >= 0:
        pos = inicio + len(partes[0])
        for p in partes[1:]:
            i = alvo.find(p, pos)
            if i < 0:
                return False  # nenhum início posterior encontraria este trecho
            pos = i + len(p)
        if pos - inicio <= janela:
            return True
        inicio = alvo.find(partes[0], inicio + 1)
    return False


def tarefa_de(cid):
    return re.match(r'[A-Z]+-\d+', cid).group(0)


def selecionado(cid, filtro):
    return not filtro or cid in filtro or cid.split()[0] in filtro or tarefa_de(cid) in filtro


def main(argv):
    filtro = set(argv[argv.index('--tarefa') + 1:]) if '--tarefa' in argv else set()
    checagens = [c for c in CHECAGENS if selecionado(c[0], filtro)]
    negativos = [c for c in NEGATIVOS if selecionado(c[0], filtro)]
    if not checagens:
        print('nenhuma checagem para:', ' '.join(sorted(filtro)))
        return 2
    necessarias = sorted({c[1] for c in checagens + negativos}, key=list(PAGINAS).index)

    paginas, erros, ultimo_host = {}, {}, {}
    for chave in necessarias:
        url = PAGINAS[chave]
        host = url.split('/')[2]
        if host in ultimo_host:
            time.sleep(max(0.0, ESPERA_S - (time.monotonic() - ultimo_host[host])))
        try:
            bruto = baixar(url)
            paginas[chave] = {'html': normalizar(html.unescape(bruto)), 'texto': texto_visivel(bruto)}
        except (urllib.error.URLError, OSError) as e:
            erros[chave] = str(getattr(e, 'reason', e))
        ultimo_host[host] = time.monotonic()

    tudo_ok = True
    for negativo, lista in ((False, checagens), (True, negativos)):
        if negativo and lista:
            print('-- controles negativos (respostas trocadas; precisam NÃO casar)')
        for cid, chave, modo, trechos, janela in lista:
            if chave in erros:
                tudo_ok = False
                print(f'SEM ACESSO  {cid:15} {PAGINAS[chave]} ({erros[chave]})')
                continue
            ok = casa(paginas[chave][modo], trechos, janela) != negativo
            tudo_ok &= ok
            print(f"{'OK        ' if ok else 'FALHA     '}  {cid:15} {' > '.join(trechos)}")
    return 0 if tudo_ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
