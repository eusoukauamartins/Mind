import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, Lock, Unlock, X, Quote, BookOpen } from "lucide-react";
import { supabase, getCurrentUser } from '../lib/supabaseClient';

/*
  LyriaDailyQuotePopup.jsx

  Arquivo único para implementar a notificação/popup de Frase do Dia no Lyria.

  Como usar no app:
  1. Crie este arquivo em: src/components/LyriaDailyQuotePopup.jsx
  2. Importe no App.jsx ou Layout.jsx:
     import LyriaDailyQuotePopup from "./components/LyriaDailyQuotePopup";
  3. Renderize uma vez perto da raiz do app:
     <LyriaDailyQuotePopup />
*/

const DAILY_QUOTES = [
  {"id":1,"frase":"Quem reduz desconfiança aproxima decisão.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":2,"frase":"A impermanência ensina sem pedir licença.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":3,"frase":"A pausa revela a beleza comum quando você para de fugir.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":4,"frase":"Conhecimento cresce quando o ego aceita correção.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":5,"frase":"Conhecimento cresce quando a revisão encontra o erro.","categoria":"Conhecimento e Aprendizado","livro_base":"O Andar do Bêbado","autor_base":"Leonard Mlodinow","credito_sugerido_no_app":"Inspirado em O Andar do Bêbado — Leonard Mlodinow"},
  {"id":6,"frase":"Confiança cresce quando a resposta não atropela a pessoa.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":7,"frase":"Revisão cresce quando o ego aceita correção.","categoria":"Conhecimento e Aprendizado","livro_base":"Antifrágil","autor_base":"Nassim Nicholas Taleb","credito_sugerido_no_app":"Inspirado em Antifrágil — Nassim Nicholas Taleb"},
  {"id":8,"frase":"Não negocie com a promessa vazia; volte para a próxima ação.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":9,"frase":"Decidir é cortar caminhos para abrir destino.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":10,"frase":"Menos ruído, mais consciência.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":11,"frase":"O corpo reveals o simples quando a vida fica simples.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":12,"frase":"A confiança cresce onde a vaidade diminui.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":13,"frase":"Dinheiro sem paciência vira refém de comparação.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":14,"frase":"Quem observa o drama sem reagir encontra clareza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":15,"frase":"Firmeza cresce quando a pressão encontra método.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":16,"frase":"A atenção revela a direção escondida quando o ego descansa.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":17,"frase":"O instante revela a calma possível quando o ruído diminui.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":18,"frase":"Não negocie com a bagunça; volte para a ação pequena.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":19,"frase":"Processo melhora quando a equipe entende o porquê.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":20,"frase":"Rapport cresce quando a atenção é real.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":21,"frase":"A paz começa no espaço entre impulso e resposta.","categoria":"Presença e Consciência","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":22,"frase":"Estudo cresce quando o viés é observado.","categoria":"Conhecimento e Aprendizado","livro_base":"Rápido e Devagar","autor_base":"Daniel Kahneman","credito_sugerido_no_app":"Inspirado em Rápido e Devagar — Daniel Kahneman"},
  {"id":23,"frase":"Riqueza cresce com simplicidade, não com status.","categoria":"Finanças e Riqueza","livro_base":"O Investidor Inteligente","autor_base":"Benjamin Graham","credito_sugerido_no_app":"Inspirado em O Investidor Inteligente — Benjamin Graham"},
  {"id":24,"frase":"Arte melhora quando o corte remove excesso.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Roube como um Artista","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Roube como um Artista — Austin Kleon"},
  {"id":25,"frase":"Não negocie com a ansiedade; volte para a ação pequena.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":26,"frase":"Estratégia melhora quando a vaidade sai da mesa.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":27,"frase":"Leitura cresce quando o ego aceita correção.","categoria":"Conhecimento e Aprendizado","livro_base":"Sapiens","autor_base":"Yuval Noah Harari","credito_sugerido_no_app":"Inspirado em Sapiens — Yuval Noah Harari"},
  {"id":28,"frase":"Uma boa oferta remove risco percebido e aumenta confiança.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Pré-Suasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em Pré-Suasão — Robert B. Cialdini"},
  {"id":29,"frase":"Quem reduz confusão aproxima compra.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":30,"frase":"Riqueza cresce com margem, não com medo.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":31,"frase":"O pensamento fica leve quando o orgulho perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":32,"frase":"Riqueza cresce com disciplina, não com status.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":33,"frase":"Menos ansiedade, mais atenção.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":34,"frase":"Influência limpa cresce quando a curiosidade vence a pressa.","categoria":"Rapport, Networking e Comunicação","livro_base":"The Charisma Myth","autor_base":"Olivia Fox Cabane","credito_sugerido_no_app":"Inspirado em The Charisma Myth — Olivia Fox Cabane"},
  {"id":35,"frase":"A liberdade financeira nasce em escolhas repetidas.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":36,"frase":"Quem domina o gasto compra poder de escolha no futuro.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":37,"frase":"O instante fica leve quando o passado perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":38,"frase":"Virtude cresce quando o desconforto chega.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":39,"frase":"Roteiro melhora quando enfrenta o público.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":40,"frase":"Uma boa oferta remove atrito e aumenta urgência honesta.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Expert Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em Expert Secrets — Russell Brunson"},
  {"id":41,"frase":"O agora não grita, mas sempre chama.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":42,"frase":"Calma cresce quando o desconforto chega.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":43,"frase":"Cultura melhora quando o padrão fica explícito.","categoria":"Liderança e Estratégia","livro_base":"Maestria","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em Maestria — Robert Greene"},
  {"id":44,"frase":"Não negocie com a preguiça; volte para a execução silenciosa.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":45,"frase":"Processo melhora quando sai da cabeça.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Contágio","autor_base":"Jonah Berger","credito_sugerido_no_app":"Inspirado em Contágio — Jonah Berger"},
  {"id":46,"frase":"O pensamento fica leve quando o drama perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":47,"frase":"Menos promessa, mais prioridade do dia.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":48,"frase":"A arte cresce onde a repetição encontra presença.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Criatividade S.A.","autor_base":"Ed Catmull e Amy Wallace","credito_sugerido_no_app":"Inspirado em Criatividade S.A. — Ed Catmull e Amy Wallace"},
  {"id":49,"frase":"Menos urgência, mais vida.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":50,"frase":"Influência limpa cresce quando a curiosidade vence a pressa.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":51,"frase":"Poder melhora quando a equipe entende o porquê.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":52,"frase":"Dinheiro sem caixa vira refém de impulso.","categoria":"Finanças e Riqueza","livro_base":"O Investidor Inteligente","autor_base":"Benjamin Graham","credito_sugerido_no_app":"Inspirado em O Investidor Inteligente — Benjamin Graham"},
  {"id":53,"frase":"Liderança melhora quando o resultado vale mais que o aplauso.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":54,"frase":"Cultura melhora quando a equipe entende o porquê.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":55,"frase":"Quem reduz risco percebido aproxima movimento.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":56,"frase":"Nem toda perda diminui; algumas libertam.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":57,"frase":"Dinheiro sem margem vira refém de pressa.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":58,"frase":"Riqueza cresce com consistência, não com descontrole.","categoria":"Finanças e Riqueza","livro_base":"O Investidor Inteligente","autor_base":"Benjamin Graham","credito_sugerido_no_app":"Inspirado em O Investidor Inteligente — Benjamin Graham"},
  {"id":59,"frase":"Coragem cresce quando ninguém está olhando.","categoria":"Estoicismo e Resiliência","livro_base":"Cartas de um Estoico","autor_base":"Sêneca","credito_sugerido_no_app":"Inspirado em Cartas de um Estoico — Sêneca"},
  {"id":60,"frase":"A presença revela o que já estava aqui quando a atenção fica inteira.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":61,"frase":"Lucidez cresce quando a reclamação perde espaço.","categoria":"Estoicismo e Resiliência","livro_base":"Disciplina é Destino","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em Disciplina é Destino — Ryan Holiday"},
  {"id":62,"frase":"Sabedoria cresce quando vira decision melhor.","categoria":"Conhecimento e Aprendizado","livro_base":"Antifrágil","autor_base":"Nassim Nicholas Taleb","credito_sugerido_no_app":"Inspirado em Antifrágil — Nassim Nicholas Taleb"},
  {"id":63,"frase":"Quem observa o controle sem reagir encontra compaixão.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":64,"frase":"Não negocie com a procrastinação; volte para a rotina certa.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":65,"frase":"Repertório melhora quando a observação fica real.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Roube como um Artista","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Roube como um Artista — Austin Kleon"},
  {"id":66,"frase":"O silêncio revela o que já estava aqui quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":67,"frase":"Execução melhora quando a ação segue o princípio.","categoria":"Liderança e Estratégia","livro_base":"Maestria","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em Maestria — Robert Greene"},
  {"id":68,"frase":"O dia fica leve quando o orgulho perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":69,"frase":"Não negocie com a preguiça; volte para a decisão prática.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":70,"frase":"Riqueza cresce com tempo, não com status.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":71,"frase":"Roteiro melhora quando a prática vence o julgamento.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":72,"frase":"Riqueza cresce com clareza, não com comparação.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":73,"frase":"Lucidez cresce quando o desconforto chega.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":74,"frase":"A rotina certa remove dúvidas repetidas.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":75,"frase":"Decisão melhora quando a ação segue o princípio.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":76,"frase":"Roteiro melhora quando a repetição vira estilo.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Ideias que Colam","autor_base":"Chip Heath e Dan Heath","credito_sugerido_no_app":"Inspirado em Ideias que Colam — Chip Heath e Dan Heath"},
  {"id":77,"frase":"Curiosidade cresce quando a prática confirma a teoria.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":78,"frase":"Uma boa oferta remove atrito e aumenta segurança.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":79,"frase":"Virtude cresce quando o dia exige presença.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":80,"frase":"Cultura melhora quando o resultado vale mais que o aplauso.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":81,"frase":"O espírito fica leve quando o orgulho perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":82,"frase":"O controle interno é a primeira riqueza.","categoria":"Estoicismo e Resiliência","livro_base":"Cartas de um Estoico","autor_base":"Sêneca","credito_sugerido_no_app":"Inspirado em Cartas de um Estoico — Sêneca"},
  {"id":83,"frase":"Respeito cresce quando o silêncio também participa.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":84,"frase":"Presença cresce quando a fala serve à clareza.","categoria":"Rapport, Networking e Comunicação","livro_base":"Inteligência Emocional","autor_base":"Daniel Goleman","credito_sugerido_no_app":"Inspirado em Inteligência Emocional — Daniel Goleman"},
  {"id":85,"frase":"A conversa melhora quando a defesa vira curiosidade.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":86,"frase":"Ideia melhora quando a prática vence o julgamento.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":87,"frase":"Roteiro melhora quando a mensagem encontra tensão.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Criatividade S.A.","autor_base":"Ed Catmull e Amy Wallace","credito_sugerido_no_app":"Inspirado em Criatividade S.A. — Ed Catmull e Amy Wallace"},
  {"id":88,"frase":"A mente treinada transforma perda em lição.","categoria":"Estoicismo e Resiliência","livro_base":"Disciplina é Destino","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em Disciplina é Destino — Ryan Holiday"},
  {"id":89,"frase":"Conhecimento cresce quando a dúvida é bem tratada.","categoria":"Conhecimento e Aprendizado","livro_base":"Antifrágil","autor_base":"Nassim Nicholas Taleb","credito_sugerido_no_app":"Inspirado em Antifrágil — Nassim Nicholas Taleb"},
  {"id":90,"frase":"Uma boa oferta remove frieza e aumenta valor percebido.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":91,"frase":"Nem todo silêncio é vazio; às vezes é direção.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":92,"frase":"O instante fica mais clara quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":93,"frase":"Quem observa o desejo de aprovação sem reagir encontra paz.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":94,"frase":"Não negocie com a promessa vazia; volte para a entrega real.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":95,"frase":"Não negocie com a preguiça; volte para a próxima ação.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":96,"frase":"Clareza melhora quando o sistema reduz improviso.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":97,"frase":"O gesto fica leve quando o desejo de aprovação perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":98,"frase":"Menos ruído, mais calma.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":99,"frase":"Riqueza cresce com consistência, não com ego.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":100,"frase":"Soltar drama abre espaço para clareza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":101,"frase":"Uma boa oferta remove desconfiança e aumenta desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Breakthrough Advertising","autor_base":"Eugene M. Schwartz","credito_sugerido_no_app":"Inspirado em Breakthrough Advertising — Eugene M. Schwartz"},
  {"id":102,"frase":"A melhor fala às vezes é a pausa certa.","categoria":"Rapport, Networking e Comunicação","livro_base":"Inteligência Emocional","autor_base":"Daniel Goleman","credito_sugerido_no_app":"Inspirado em Inteligência Emocional — Daniel Goleman"},
  {"id":103,"frase":"Volume com atenção vira repertório.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Criatividade S.A.","autor_base":"Ed Catmull e Amy Wallace","credito_sugerido_no_app":"Inspirado em Criatividade S.A. — Ed Catmull e Amy Wallace"},
  {"id":104,"frase":"Quem domina o gasto compra futuro no futuro.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":105,"frase":"Não negocie com a distração; volte para a entrega real.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":106,"frase":"O maior retorno às vezes é evitar a decisão errada.","categoria":"Finanças e Riqueza","livro_base":"O Investidor Inteligente","autor_base":"Benjamin Graham","credito_sugerido_no_app":"Inspirado em O Investidor Inteligente — Benjamin Graham"},
  {"id":107,"frase":"A consciência fica mais clara quando o ego descansa.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":108,"frase":"Carisma cresce quando a fala serve à clareza.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":109,"frase":"Não negocie com a urgência falsa; volte para a repetição diária.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":110,"frase":"Confiança cresce quando a verdade vem com cuidado.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":111,"frase":"O conhecimento amadurece entre estudo e prática.","categoria":"Conhecimento e Aprendizado","livro_base":"Antifrágil","autor_base":"Nassim Nicholas Taleb","credito_sugerido_no_app":"Inspirado em Antifrágil — Nassim Nicholas Taleb"},
  {"id":112,"frase":"Leitura cresce quando vira decisão melhor.","categoria":"Conhecimento e Aprendizado","livro_base":"Ultralearning","autor_base":"Scott H. Young","credito_sugerido_no_app":"Inspirado em Ultralearning — Scott H. Young"},
  {"id":113,"frase":"Repertório melhora quando a prática vence o julgamento.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Roube como um Artista","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Roube como um Artista — Austin Kleon"},
  {"id":114,"frase":"Presença cresce quando a curiosidade vence a pressa.","categoria":"Rapport, Networking e Comunicação","livro_base":"The Charisma Myth","autor_base":"Olivia Fox Cabane","credito_sugerido_no_app":"Inspirado em The Charisma Myth — Olivia Fox Cabane"},
  {"id":115,"frase":"Quem reduz atrito aproxima resposta.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Breakthrough Advertising","autor_base":"Eugene M. Schwartz","credito_sugerido_no_app":"Inspirado em Breakthrough Advertising — Eugene M. Schwartz"},
  {"id":116,"frase":"Não negocie com a bagunça; volte para a repetição diária.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":117,"frase":"Autoridade sem serviço vira apenas cargo.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":118,"frase":"Caráter cresce quando a pressão encontra método.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":119,"frase":"Estudo cresce quando vira decisão melhor.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":120,"frase":"Resiliência cresce quando a realidade contraria o plano.","categoria":"Estoicismo e Resiliência","livro_base":"Disciplina é Destino","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em Disciplina é Destino — Ryan Holiday"},
  {"id":121,"frase":"Clareza melhora quando o resultado vale mais que o aplauso.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":122,"frase":"Caráter cresce quando o impulso encontra pausa.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":123,"frase":"Menos fuga, mais atenção.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":124,"frase":"Não procure clima; construa ritmo.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":125,"frase":"Nem todo desconto é economia; alguns compram arrependimento.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":126,"frase":"Quem reduz objeção aproxima atenção.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":127,"frase":"Pensamento cresce quando vira decision melhor.","categoria":"Conhecimento e Aprendizado","livro_base":"Rápido e Devagar","autor_base":"Daniel Kahneman","credito_sugerido_no_app":"Inspirado em Rápido e Devagar — Daniel Kahneman"},
  {"id":128,"frase":"A mente revela a lucidez quando você para de fugir.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":129,"frase":"Firmeza cresce quando a emoção pede comando.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":130,"frase":"Revisão cresce quando a pergunta fica precisa.","categoria":"Conhecimento e Aprendizado","livro_base":"Sapiens","autor_base":"Yuval Noah Harari","credito_sugerido_no_app":"Inspirado em Sapiens — Yuval Noah Harari"},
  {"id":131,"frase":"Dinheiro sem caixa vira refém de dívida ruim.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":132,"frase":"Não negocie com a urgência falsa; volte para a tarefa simples.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":133,"frase":"Vença a ação pequena; o resto ganha forma depois.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":134,"frase":"A atenção fica mais clara quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":135,"frase":"Soltar impulso abre espaço para clareza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":136,"frase":"Quem reduz medo aproxima confiança.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Breakthrough Advertising","autor_base":"Eugene M. Schwartz","credito_sugerido_no_app":"Inspirado em Breakthrough Advertising — Eugene M. Schwartz"},
  {"id":137,"frase":"O mercado recompensa quem traduz desejo em clareza.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":138,"frase":"Dinheiro sem controle vira refém de ego.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":139,"frase":"Criar é organizar coragem em forma visível.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Ideias que Colam","autor_base":"Chip Heath e Dan Heath","credito_sugerido_no_app":"Inspirado em Ideias que Colam — Chip Heath e Dan Heath"},
  {"id":140,"frase":"Gentileza com limite ainda é força.","categoria":"Rapport, Networking e Comunicação","livro_base":"Inteligência Emocional","autor_base":"Daniel Goleman","credito_sugerido_no_app":"Inspirado em Inteligência Emocional — Daniel Goleman"},
  {"id":141,"frase":"Firmeza cresce quando ninguém está olhando.","categoria":"Estoicismo e Resiliência","livro_base":"Disciplina é Destino","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em Disciplina é Destino — Ryan Holiday"},
  {"id":142,"frase":"A atenção é a porta; a confiança é a chave.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":143,"frase":"Processo melhora quando a clareza guia a estética.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Ideias que Colam","autor_base":"Chip Heath e Dan Heath","credito_sugerido_no_app":"Inspirado em Ideias que Colam — Chip Heath e Dan Heath"},
  {"id":144,"frase":"Roteiro melhora quando o medo perde prioridade.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Criatividade S.A.","autor_base":"Ed Catmull e Amy Wallace","credito_sugerido_no_app":"Inspirado em Criatividade S.A. — Ed Catmull e Amy Wallace"},
  {"id":145,"frase":"Consistência melhora quando o exemplo vem antes da cobrança.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":146,"frase":"Quem reduz frieza aproxima atenção.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Expert Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em Expert Secrets — Russell Brunson"},
  {"id":147,"frase":"A vaidade gasta; a estratégia acumula.","categoria":"Finanças e Riqueza","livro_base":"O Investidor Inteligente","autor_base":"Benjamin Graham","credito_sugerido_no_app":"Inspirado em O Investidor Inteligente — Benjamin Graham"},
  {"id":148,"frase":"Caráter cresce quando a realidade contraria o plano.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":149,"frase":"Confiança cresce quando a atenção é real.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":150,"frase":"Calma cresce quando a emoção pede comando.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":151,"frase":"A consciência fica mais clara quando o excesso sai de cena.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":152,"frase":"Decisão melhora quando a pressão não rouba a visão.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":153,"frase":"O vazio assusta apenas quem se confunde com o excesso.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":154,"frase":"Menos promessa, mais decisão prática.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":155,"frase":"A vida fica profunda quando a atenção fica inteira.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":156,"frase":"Menos ruído, mais calma.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":157,"frase":"Dinheiro sem risco medido vira refém de dívida ruim.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":158,"frase":"Não negocie com a perfeccionismo; volte para a decisão prática.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":159,"frase":"Soltar desejo de aprovação abre espaço para clareza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":160,"frase":"A dor ensina quando encontra uma mente desperta.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":161,"frase":"Responsabilidade melhora quando o padrão fica explícito.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":162,"frase":"Uma boa oferta remove desconfiança e aumenta desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Breakthrough Advertising","autor_base":"Eugene M. Schwartz","credito_sugerido_no_app":"Inspirado em Breakthrough Advertising — Eugene M. Schwartz"},
  {"id":163,"frase":"Não negocie com a desculpa; volte para a entrega real.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":164,"frase":"Uma boa oferta remove risco percebido e aumenta desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":165,"frase":"A consciência fica mais clara quando a urgência perde força.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":166,"frase":"O corpo revela a lucidez quando a urgência perde força.","categoria":"Presença e Consciência","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":167,"frase":"A informação só vira poder quando orienta ação.","categoria":"Conhecimento e Aprendizado","livro_base":"Rápido e Devagar","autor_base":"Daniel Kahneman","credito_sugerido_no_app":"Inspirado em Rápido e Devagar — Daniel Kahneman"},
  {"id":168,"frase":"Uma boa oferta remove dúvida e aumenta desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Pré-Suasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em Pré-Suasão — Robert B. Cialdini"},
  {"id":169,"frase":"Quem valida primeiro discorda melhor depois.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":170,"frase":"Não negocie com a drama; volte para a rotina certa.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":171,"frase":"Riqueza cresce com controle, não com medo.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":172,"frase":"Coragem cresce quando a perda vira treino.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":173,"frase":"O desconforto de hoje compra força para amanhã.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":174,"frase":"Quem domina o gasto compra opção no futuro.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":175,"frase":"A disciplina começa quando a vontade acaba.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":176,"frase":"Curiosidade cresce quando vira decisão melhor.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":177,"frase":"Disciplina cresce quando a perda vira treino.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":178,"frase":"Uma boa oferta remove dúvida e aumenta simplicidade.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Pré-Suasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em Pré-Suasão — Robert B. Cialdini"},
  {"id":179,"frase":"O medo da crítica cobra aluguel da sua voz.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Mostre seu Trabalho","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Mostre seu Trabalho — Austin Kleon"},
  {"id":180,"frase":"A presença fica mais clara quando você volta para o corpo.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":181,"frase":"Aprendizado cresce quando a pergunta fica precisa.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":182,"frase":"A pressa cobra juros invisíveis.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":183,"frase":"Uma boa oferta remove atrito e aumenta autoridade.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":184,"frase":"Dinheiro sem tempo vira refém de descontrole.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":185,"frase":"Dinheiro sem paciência vira refém de decisão emocional.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":186,"frase":"Comprar menos pode ser ganhar futuro.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":187,"frase":"Quem observa o drama sem reagir encontra liberdade.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":188,"frase":"Sofrer antes da hora é pagar juros ao medo.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":189,"frase":"Riqueza cresce com caixa, não com vaidade.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":190,"frase":"Quem observa o desejo de aprovação sem reagir encontra leveza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":191,"frase":"A calma revela a verdade do momento quando a atenção fica inteira.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":192,"frase":"O gesto fica leve quando o excesso perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":193,"frase":"Confiança cresce quando o interesse é genuíno.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":194,"frase":"Soltar impulso abre espaço para silêncio.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":195,"frase":"Riqueza cresce com paciência, não com medo.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":196,"frase":"Uma boa oferta remove medo e aumenta autoridade.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":197,"frase":"O apego ao apego transforma o caminho em peso.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":198,"frase":"Soltar desejo de aprovação abre espaço para liberdade.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":199,"frase":"O corpo fica leve quando o medo perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":200,"frase":"Não negocie com a ansiedade; volte para o primeiro bloco.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":201,"frase":"Quem reduz confusão aproxima desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":202,"frase":"Não negocie com a ansiedade; volte para a rotina certa.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":203,"frase":"Uma boa oferta remove promessa vaga e aumenta posicionamento.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Pré-Suasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em Pré-Suasão — Robert B. Cialdini"},
  {"id":204,"frase":"Menos drama, mais quietude.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":205,"frase":"Uma boa oferta remove frieza e aumenta desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":206,"frase":"Não negocie com a drama; volte para a decisão prática.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":207,"frase":"Quem reduz objeção aproxima ação.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":208,"frase":"Uma boa ideia precisa de corte, não só de brilho.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Ideias que Colam","autor_base":"Chip Heath e Dan Heath","credito_sugerido_no_app":"Inspirado em Ideias que Colam — Chip Heath e Dan Heath"},
  {"id":209,"frase":"Não negocie com a urgência falsa; volte para a ação pequena.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":210,"frase":"O roteiro bom começa com uma tensão clara.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Ideias que Colam","autor_base":"Chip Heath e Dan Heath","credito_sugerido_no_app":"Inspirado em Ideias que Colam — Chip Heath e Dan Heath"},
  {"id":211,"frase":"Menos fuga, mais clareza.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":212,"frase":"Não negocie com a desculpa; volte para a próxima ação.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":213,"frase":"A respiração fica mais clara quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":214,"frase":"A ideia melhora quando encontra o mundo.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Contágio","autor_base":"Jonah Berger","credito_sugerido_no_app":"Inspirado em Contágio — Jonah Berger"},
  {"id":215,"frase":"Produção melhora quando enfrenta o público.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Contágio","autor_base":"Jonah Berger","credito_sugerido_no_app":"Inspirado em Contágio — Jonah Berger"},
  {"id":216,"frase":"Menos urgência, mais calma.","categoria":"Presença e Consciência","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":217,"frase":"Autocontrole cresce quando o dia exige presença.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":218,"frase":"Uma boa oferta remove objeção e aumenta prova.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":219,"frase":"Quem reduz objeção aproxima desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Expert Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em Expert Secrets — Russell Brunson"},
  {"id":220,"frase":"Todo avanço grande já foi uma ação pequena.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":221,"frase":"Não negocie com a urgência falsa; volte para a decisão prática.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":222,"frase":"Quem observa o passado sem reagir encontra maturidade.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":223,"frase":"Não negocie com a bagunça; volte para a entrega real.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":224,"frase":"A presença revela a calma possível quando a atenção fica inteira.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":225,"frase":"Leitura cresce quando a pressa sai do caminho.","categoria":"Conhecimento e Aprendizado","livro_base":"Rápido e Devagar","autor_base":"Daniel Kahneman","credito_sugerido_no_app":"Inspirado em Rápido e Devagar — Daniel Kahneman"},
  {"id":226,"frase":"Quem reduz dúvida aproxima venda.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":227,"frase":"Não negocie com a preguiça; volte para a tarefa simples.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":228,"frase":"Dinheiro sem clareza vira refém de status.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":229,"frase":"Aprendizado cresce quando o viés é observado.","categoria":"Conhecimento e Aprendizado","livro_base":"Antifrágil","autor_base":"Nassim Nicholas Taleb","credito_sugerido_no_app":"Inspirado em Antifrágil — Nassim Nicholas Taleb"},
  {"id":230,"frase":"Quem reduz dúvida aproxima confiança.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Pré-Suasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em Pré-Suasão — Robert B. Cialdini"},
  {"id":231,"frase":"Uma boa oferta remove desconfiança e aumenta clareza.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":232,"frase":"Leitura cresce quando a prática confirma a teoria.","categoria":"Conhecimento e Aprendizado","livro_base":"Antifrágil","autor_base":"Nassim Nicholas Taleb","credito_sugerido_no_app":"Inspirado em Antifrágil — Nassim Nicholas Taleb"},
  {"id":233,"frase":"Virtude cresce quando a realidade contraria o plano.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":234,"frase":"Disciplina cresce quando a realidade contraria o plano.","categoria":"Estoicismo e Resiliência","livro_base":"Cartas de um Estoico","autor_base":"Sêneca","credito_sugerido_no_app":"Inspirado em Cartas de um Estoico — Sêneca"},
  {"id":235,"frase":"Ideia melhora quando enfrenta o público.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":236,"frase":"Menos ansiedade, mais calma.","categoria":"Presença and Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":237,"frase":"Resiliência cresce quando o medo não decide sozinho.","categoria":"Estoicismo e Resiliência","livro_base":"Cartas de um Estoico","autor_base":"Sêneca","credito_sugerido_no_app":"Inspirado em Cartas de um Estoico — Sêneca"},
  {"id":238,"frase":"Comprar menos pode ser ganhar margem.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":239,"frase":"O ego exige; a sabedoria observa.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":240,"frase":"Uma boa oferta remove confusão e aumenta simplicidade.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Pré-Suasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em Pré-Suasão — Robert B. Cialdini"},
  {"id":241,"frase":"Poder melhora quando a vaidade sai da mesa.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":242,"frase":"Não negocie com a drama; volte para a entrega real.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":243,"frase":"A inteligência cresce quando o ego tolera correção.","categoria":"Conhecimento e Aprendizado","livro_base":"Ultralearning","autor_base":"Scott H. Young","credito_sugerido_no_app":"Inspirado em Ultralearning — Scott H. Young"},
  {"id":244,"frase":"Estratégia melhora quando o exemplo vem antes da cobrança.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":245,"frase":"Repertório melhora quando o medo perde prioridade.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Criatividade S.A.","autor_base":"Ed Catmull e Amy Wallace","credito_sugerido_no_app":"Inspirado em Criatividade S.A. — Ed Catmull e Amy Wallace"},
  {"id":246,"frase":"Disciplina cresce quando ninguém está olhando.","categoria":"Estoicismo e Resiliência","livro_base":"Disciplina é Destino","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em Disciplina é Destino — Ryan Holiday"},
  {"id":247,"frase":"Riqueza cresce com controle, não com decisão emocional.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":248,"frase":"Quem observa o passado sem reagir encontra compaixão.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":249,"frase":"Uma boa oferta remove frieza e aumenta clareza.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":250,"frase":"Processo melhora quando a repetição vira estilo.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Contágio","autor_base":"Jonah Berger","credito_sugerido_no_app":"Inspirado em Contágio — Jonah Berger"},
  {"id":251,"frase":"O silêncio revela o espaço interno quando o ego descansa.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":252,"frase":"Não negocie com a promessa vazia; volte para a decisão prática.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":253,"frase":"A escuta revela o instante quando a atenção fica inteira.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":254,"frase":"Dinheiro sem margem vira refém de medo.","categoria":"Finanças e Riqueza","livro_base":"O Investidor Inteligente","autor_base":"Benjamin Graham","credito_sugerido_no_app":"Inspirado em O Investidor Inteligente — Benjamin Graham"},
  {"id":255,"frase":"Poder melhora quando a ação segue o princípio.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":256,"frase":"A constância constrói futuro sem fazer barulho.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":257,"frase":"Clareza cresce quando a prática confirma a teoria.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":258,"frase":"Quem domina o gasto compra tempo no futuro.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":259,"frase":"Soltar desejo de posse abre espaço para espaço.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":260,"frase":"A constância constrói domínio sem fazer barulho.","categoria":"Disciplina and Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":261,"frase":"Vença a repetição diária; o resto ganha forma depois.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":262,"frase":"O corpo fica mais clara quando você volta para o corpo.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":263,"frase":"Comprar menos pode ser ganhar segurança.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":264,"frase":"Autoridade calma cresce quando o interesse é genuíno.","categoria":"Rapport, Networking e Comunicação","livro_base":"Inteligência Emocional","autor_base":"Daniel Goleman","credito_sugerido_no_app":"Inspirado em Inteligência Emocional — Daniel Goleman"},
  {"id":265,"frase":"Uma boa oferta remove risco percebido e aumenta prova.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":266,"frase":"Negociação boa começa antes do pedido.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":267,"frase":"Processo melhora quando o exemplo vem antes da cobrança.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":268,"frase":"Conexão cresce quando a intenção fica limpa.","categoria":"Rapport, Networking e Comunicação","livro_base":"The Charisma Myth","autor_base":"Olivia Fox Cabane","credito_sugerido_no_app":"Inspirado em The Charisma Myth — Olivia Fox Cabane"},
  {"id":269,"frase":"Publicar é testar pensamento em público.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Roube como um Artista","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Roube como um Artista — Austin Kleon"},
  {"id":270,"frase":"Pergunta clara vale mais que resposta apressada.","categoria":"Conhecimento e Aprendizado","livro_base":"O Andar do Bêbado","autor_base":"Leonard Mlodinow","credito_sugerido_no_app":"Inspirado em O Andar do Bêbado — Leonard Mlodinow"},
  {"id":271,"frase":"Riqueza cresce com tempo, não com ego.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":272,"frase":"O silêncio fica mais clara quando o ego descansa.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":273,"frase":"Poder real aparece no autocontrole.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":274,"frase":"O dia fica leve quando o apego perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":275,"frase":"Quem observa o orgulho sem reagir encontra leveza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":276,"frase":"Quem reduz ruído aproxima venda.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Breakthrough Advertising","autor_base":"Eugene M. Schwartz","credito_sugerido_no_app":"Inspirado em Breakthrough Advertising — Eugene M. Schwartz"},
  {"id":277,"frase":"Influência limpa cresce quando a atenção é real.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":278,"frase":"Quem observa o passado sem reagir encontra paz.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":279,"frase":"Caráter cresce quando a emoção pede comando.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":280,"frase":"O caixa protege sonhos de decisões emocionais.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":281,"frase":"Originalidade melhora quando a prática vence o julgamento.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":282,"frase":"O ego quer crédito; a liderança quer resultado.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":283,"frase":"Estudo cresce quando a pressa sai do caminho.","categoria":"Conhecimento e Aprendizado","livro_base":"Ultralearning","autor_base":"Scott H. Young","credito_sugerido_no_app":"Inspirado em Ultralearning — Scott H. Young"},
  {"id":284,"frase":"Processo melhora quando a mensagem encontra tensão.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Ideias que Colam","autor_base":"Chip Heath e Dan Heath","credito_sugerido_no_app":"Inspirado em Ideias que Colam — Chip Heath e Dan Heath"},
  {"id":285,"frase":"Autocontrole cresce quando a perda vira treino.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":286,"frase":"Não negocie com a ansiedade; volte para a tarefa simples.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":287,"frase":"Menos comparação, mais escuta.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":288,"frase":"Processo melhora quando o problema é medido sem drama.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":289,"frase":"Soltar desejo de aprovação abre espaço para leveza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":290,"frase":"A presença transforma o comum em sagrado.","categoria":"Presença e Consciência","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":291,"frase":"O caminho fica leve quando o impulso perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":292,"frase":"Caráter cresce quando a perda vira treino.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":293,"frase":"Estratégia é escolher perdas aceitáveis por ganhos maiores.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":294,"frase":"Não negocie com a promessa vazia; volte para o primeiro bloco.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":295,"frase":"Confiança cresce quando a fala serve à clareza.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":296,"frase":"O silêncio revela o instante quando o ego descansa.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":297,"frase":"O caminho fica leve quando o desejo de posse perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":298,"frase":"O apego ao desejo de posse transforma o caminho em peso.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":299,"frase":"Não negocie com a bagunça; volte para a decisão prática.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":300,"frase":"A ação imperfeita ensina mais que o plano eterno.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":301,"frase":"Calma cresce quando a perda vira treino.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":302,"frase":"O líder que escuta enxerga antes da crise.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":303,"frase":"Menos fuga, mais presença.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":304,"frase":"Conhecimento cresce quando vira decisão melhor.","categoria":"Conhecimento e Aprendizado","livro_base":"Rápido e Devagar","autor_base":"Daniel Kahneman","credito_sugerido_no_app":"Inspirado em Rápido e Devagar — Daniel Kahneman"},
  {"id":305,"frase":"A constância constrói progresso sem fazer barulho.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":306,"frase":"Não negocie com a perfeccionismo; volte para a ação pequena.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":307,"frase":"Processo melhora quando o processo fica visível.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Ideias que Colam","autor_base":"Chip Heath e Dan Heath","credito_sugerido_no_app":"Inspirado em Ideias que Colam — Chip Heath e Dan Heath"},
  {"id":308,"frase":"Empatia cresce quando a curiosidade vence a pressa.","categoria":"Rapport, Networking e Comunicação","livro_base":"The Charisma Myth","autor_base":"Olivia Fox Cabane","credito_sugerido_no_app":"Inspirado em The Charisma Myth — Olivia Fox Cabane"},
  {"id":309,"frase":"A consciência revela a beleza comum quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":310,"frase":"Pensar melhor é enxergar o próprio viés.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":311,"frase":"Menos drama, mais vida.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":312,"frase":"Quem observa o excesso sem reagir encontra espaço.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":313,"frase":"A presença fica mais clara quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":314,"frase":"Coragem cresce quando a realidade contraria o plano.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":315,"frase":"Rapport cresce quando a fala serve à clareza.","categoria":"Rapport, Networking e Comunicação","livro_base":"The Charisma Myth","autor_base":"Olivia Fox Cabane","credito_sugerido_no_app":"Inspirado em The Charisma Myth — Olivia Fox Cabane"},
  {"id":316,"frase":"Menos distração, mais escuta.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":317,"frase":"Prática cresce quando o ego aceita correção.","categoria":"Conhecimento e Aprendizado","livro_base":"Rápido e Devagar","autor_base":"Daniel Kahneman","credito_sugerido_no_app":"Inspirado em Rápido e Devagar — Daniel Kahneman"},
  {"id":318,"frase":"Não negocie com a urgência falsa; volte para o primeiro bloco.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":319,"frase":"Empatia cresce quando a atenção é real.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":320,"frase":"Execução melhora quando a escolha tem custo claro.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":321,"frase":"Quem quer conexão precisa abandonar a performance.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":322,"frase":"Publicação melhora quando sai da cabeça.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Mostre seu Trabalho","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Mostre seu Trabalho — Austin Kleon"},
  {"id":323,"frase":"Não negocie com a ansiedade; volte para a prioridade do dia.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":324,"frase":"Arte melhora quando a observação fica real.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Criatividade S.A.","autor_base":"Ed Catmull e Amy Wallace","credito_sugerido_no_app":"Inspirado em Criatividade S.A. — Ed Catmull e Amy Wallace"},
  {"id":325,"frase":"Soltar passado abre espaço para leveza.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":326,"frase":"Estudo cresce quando a revisão encontra o erro.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":327,"frase":"Lucidez cresce quando a perda vira treino.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":328,"frase":"A pausa revela a calma possível quando você volta para o corpo.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":329,"frase":"Autocontrole cresce quando o impulso encontra pausa.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":330,"frase":"Quem reduz dúvida aproxima conversão.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":331,"frase":"Revisão cresce quando a mente aceita complexidade.","categoria":"Conhecimento e Aprendizado","livro_base":"Sapiens","autor_base":"Yuval Noah Harari","credito_sugerido_no_app":"Inspirado em Sapiens — Yuval Noah Harari"},
  {"id":332,"frase":"Riqueza cresce com caixa, não com vaidade.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":333,"frase":"Conexão cresce quando a verdade vem com cuidado.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":334,"frase":"Originalidade melhora quando o medo perde prioridade.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Roube como um Artista","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Roube como um Artista — Austin Kleon"},
  {"id":335,"frase":"Execução melhora quando a vaidade sai da mesa.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":336,"frase":"Comprar menos pode ser ganhar poder de escolha.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":337,"frase":"Carisma cresce quando a atenção é real.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":338,"frase":"Presença cresce quando o ego diminui.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":339,"frase":"Quem observa o orgulho sem reagir encontra liberdade.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":340,"frase":"A reação é onde sua liberdade começa.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":341,"frase":"Não negocie com a promessa vazia; volte para a execução silenciosa.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":342,"frase":"Quem observa o drama sem reagir encontra sabedoria.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":343,"frase":"Não negocie com a urgência falsa; volte para a entrega real.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":344,"frase":"Não negocie com a distração; volte para a execução silenciosa.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":345,"frase":"Riqueza cresce com simplicidade, não com comparação.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":346,"frase":"Respeito cresce quando o respeito antecede o pedido.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":347,"frase":"Roteiro melhora quando o corte remove excesso.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Contágio","autor_base":"Jonah Berger","credito_sugerido_no_app":"Inspirado em Contágio — Jonah Berger"},
  {"id":348,"frase":"Autoridade calma cresce quando a fala serve à clareza.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":349,"frase":"Carisma cresce quando o silêncio também participa.","categoria":"Rapport, Networking e Comunicação","livro_base":"The Charisma Myth","autor_base":"Olivia Fox Cabane","credito_sugerido_no_app":"Inspirado em The Charisma Myth — Olivia Fox Cabane"},
  {"id":350,"frase":"Quem reduz dúvida aproxima resposta.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":351,"frase":"A constância constrói progresso sem fazer barulho.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":352,"frase":"Quem reduz risco percebido aproxima ação.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":353,"frase":"Aprendizado cresce quando a mente aceita complexidade.","categoria":"Conhecimento e Aprendizado","livro_base":"Ultralearning","autor_base":"Scott H. Young","credito_sugerido_no_app":"Inspirado em Ultralearning — Scott H. Young"},
  {"id":354,"frase":"A conexão começa quando a escuta fica maior que a resposta.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":355,"frase":"Uma boa oferta remove promessa vaga e aumenta desejo.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":356,"frase":"Paciência cresce quando ninguém está olhando.","categoria":"Estoicismo e Resiliência","livro_base":"Disciplina é Destino","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em Disciplina é Destino — Ryan Holiday"},
  {"id":357,"frase":"Volte para a respiração; o resto pode esperar.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":358,"frase":"A serenidade cresce quando você para de agarrar o transitório.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":359,"frase":"Conexão cresce quando a resposta não atropela a pessoa.","categoria":"Rapport, Networking e Comunicação","livro_base":"Inteligência Emocional","autor_base":"Daniel Goleman","credito_sugerido_no_app":"Inspirado em Inteligência Emocional — Daniel Goleman"},
  {"id":360,"frase":"Dinheiro sem caixa vira refém de medo.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":361,"frase":"A atenção fica mais clara quando o ego descansa.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":362,"frase":"Liderar é assumir a parte que seria fácil culpar.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":363,"frase":"Uma boa oferta remove atrito e aumenta simplicidade.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":364,"frase":"Soltar drama abre espaço para espaço.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":365,"frase":"Persuasão limpa ajuda o cliente a decidir sem pressão.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Expert Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em Expert Secrets — Russell Brunson"},
  {"id":366,"frase":"Autoridade melhora quando o padrão fica explícito.","categoria":"Liderança e Estratégia","livro_base":"Maestria","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em Maestria — Robert Greene"},
  {"id":367,"frase":"Calma cresce quando o impulso encontra pausa.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":368,"frase":"O simples aparece quando a pressa sai da frente.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":369,"frase":"Uma boa oferta remove ruído e aumenta confiança.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":370,"frase":"A agenda revela o que a boca apenas prometeu.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":371,"frase":"Calma cresce quando o dia exige presença.","categoria":"Estoicismo e Resiliência","livro_base":"Meditações","autor_base":"Marco Aurélio","credito_sugerido_no_app":"Inspirado em Meditações — Marco Aurélio"},
  {"id":372,"frase":"Uma boa oferta remove promessa vaga e aumenta autoridade.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":373,"frase":"A mente livre não precisa vencer toda sensação.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":374,"frase":"Pensamento cresce quando a mente aceita complexidade.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":375,"frase":"Menos comparação, mais consciência.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":376,"frase":"O padrão que você tolera vira cultura.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":377,"frase":"Soltar orgulho abre espaço para liberdade.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":378,"frase":"A atenção revela a vida sem excesso quando a pressa perde o comando.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":379,"frase":"Clareza cresce quando o viés é observado.","categoria":"Conhecimento e Aprendizado","livro_base":"Ultralearning","autor_base":"Scott H. Young","credito_sugerido_no_app":"Inspirado em Ultralearning — Scott H. Young"},
  {"id":380,"frase":"Responsabilidade melhora quando a pressão não rouba a visão.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":381,"frase":"A dúvida certa economiza anos de erro.","categoria":"Conhecimento e Aprendizado","livro_base":"Sapiens","autor_base":"Yuval Noah Harari","credito_sugerido_no_app":"Inspirado em Sapiens — Yuval Noah Harari"},
  {"id":382,"frase":"Quem protege o foco protege o futuro.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":383,"frase":"Pensamento cresce quando a informação ganha contexto.","categoria":"Conhecimento e Aprendizado","livro_base":"Sapiens","autor_base":"Yuval Noah Harari","credito_sugerido_no_app":"Inspirado em Sapiens — Yuval Noah Harari"},
  {"id":384,"frase":"Dinheiro sem risco medido vira refém de vaidade.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":385,"frase":"Uma boa oferta remove confusão e aumenta valor percebido.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":386,"frase":"Riqueza cresce com simplicidade, não com dívida ruim.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":387,"frase":"Riqueza cresce com disciplina, não com vaidade.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":388,"frase":"Calma cresce quando a reclamação perde espaço.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":389,"frase":"Coragem cresce quando o impulso encontra pausa.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":390,"frase":"O silêncio revela o que já estava aqui quando o excesso sai de cena.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":391,"frase":"Produção melhora quando o processo fica visível.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Contágio","autor_base":"Jonah Berger","credito_sugerido_no_app":"Inspirado em Contágio — Jonah Berger"},
  {"id":392,"frase":"O instante fica leve quando o desejo de posse perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":393,"frase":"Menos drama, mais escuta.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":394,"frase":"A calma fica mais clara quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":395,"frase":"Não negocie com a desculpa; volte para a decisão prática.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":396,"frase":"Uma boa oferta remove desconfiança e aumenta urgência honesta.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Breakthrough Advertising","autor_base":"Eugene M. Schwartz","credito_sugerido_no_app":"Inspirado em Breakthrough Advertising — Eugene M. Schwartz"},
  {"id":397,"frase":"Menos controle, mais atenção.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":398,"frase":"Quem observa o drama sem reagir encontra maturidade.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":399,"frase":"O caminho fica leve quando o medo perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":400,"frase":"A constância constrói clareza sem fazer barulho.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":401,"frase":"Sabedoria cresce quando o viés é observado.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":402,"frase":"O foco cresce quando o ambiente fica simples.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":403,"frase":"Autoridade melhora quando o exemplo vem antes da cobrança.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":404,"frase":"Conhecimento cresce quando o viés é observado.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"},
  {"id":405,"frase":"Não negocie com a desculpa; volte para a repetição diária.","categoria":"Disciplina e Execução","livro_base":"A Guerra da Arte","autor_base":"Steven Pressfield","credito_sugerido_no_app":"Inspirado em A Guerra da Arte — Steven Pressfield"},
  {"id":406,"frase":"Menos promessa, mais ação pequena.","categoria":"Disciplina e Execução","livro_base":"A Única Coisa","autor_base":"Gary Keller e Jay Papasan","credito_sugerido_no_app":"Inspirado em A Única Coisa — Gary Keller e Jay Papasan"},
  {"id":407,"frase":"Não negocie com a desculpa; volte para a rotina certa.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":408,"frase":"A respiração revela a calma possível quando a respiração guia.","categoria":"Presença e Consciência","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":409,"frase":"Clareza melhora quando o problema é medido sem drama.","categoria":"Liderança e Estratégia","livro_base":"Princípios","autor_base":"Ray Dalio","credito_sugerido_no_app":"Inspirado em Princípios — Ray Dalio"},
  {"id":410,"frase":"A empatia não enfraquece a estratégia; ela a afia.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":411,"frase":"Liderança melhora quando o problema é medido sem drama.","categoria":"Liderança e Estratégia","livro_base":"Extreme Ownership","autor_base":"Jocko Willink e Leif Babin","credito_sugerido_no_app":"Inspirado em Extreme Ownership — Jocko Willink e Leif Babin"},
  {"id":412,"frase":"Não negocie com a bagunça; volte para a próxima ação.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":413,"frase":"Menos pressa, mais calma.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":414,"frase":"Virtude cresce quando o medo não decide sozinho.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":415,"frase":"Firmeza cresce quando o desconforto chega.","categoria":"Estoicismo e Resiliência","livro_base":"Disciplina é Destino","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em Disciplina é Destino — Ryan Holiday"},
  {"id":416,"frase":"Criatividade melhora quando enfrenta o público.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Contágio","autor_base":"Jonah Berger","credito_sugerido_no_app":"Inspirado em Contágio — Jonah Berger"},
  {"id":417,"frase":"Quem observa o controle sem reagir encontra maturidade.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":418,"frase":"Carisma cresce quando o ego diminui.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":419,"frase":"Revisão cresce quando a pressa sai do caminho.","categoria":"Conhecimento e Aprendizado","livro_base":"Sapiens","autor_base":"Yuval Noah Harari","credito_sugerido_no_app":"Inspirado em Sapiens — Yuval Noah Harari"},
  {"id":420,"frase":"Quem quer escalar transforma intuição em processo.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":421,"frase":"Prática cresce quando a revisão encontra o erro.","categoria":"Conhecimento e Aprendizado","livro_base":"O Andar do Bêbado","autor_base":"Leonard Mlodinow","credito_sugerido_no_app":"Inspirado em O Andar do Bêbado — Leonard Mlodinow"},
  {"id":422,"frase":"Criatividade melhora quando sai da cabeça.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Roube como um Artista","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Roube como um Artista — Austin Kleon"},
  {"id":423,"frase":"Soltar apego abre espaço para espaço.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":424,"frase":"Liderança melhora quando o sistema reduz improviso.","categoria":"Liderança e Estratégia","livro_base":"Maestria","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em Maestria — Robert Greene"},
  {"id":425,"frase":"A escuta revela a lucidez quando a atenção fica inteira.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":426,"frase":"Publicação melhora quando a observação fica real.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Roube como um Artista","autor_base":"Austin Kleon","credito_sugerido_no_app":"Inspirado em Roube como um Artista — Austin Kleon"},
  {"id":427,"frase":"O mapa melhora quando você aceita que não viu tudo.","categoria":"Conhecimento e Aprendizado","livro_base":"Ultralearning","autor_base":"Scott H. Young","credito_sugerido_no_app":"Inspirado em Ultralearning — Scott H. Young"},
  {"id":428,"frase":"Quem reduz confusão aproxima venda.","categoria":"Negócios, Vendas e Persuasão","livro_base":"DotCom Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em DotCom Secrets — Russell Brunson"},
  {"id":429,"frase":"Clareza melhora quando a escolha tem custo claro.","categoria":"Liderança e Estratégia","livro_base":"Maestria","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em Maestria — Robert Greene"},
  {"id":430,"frase":"Uma boa oferta remove ruído e aumenta posicionamento.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":431,"frase":"Dinheiro sem risco medido vira refém de comparação.","categoria":"Finanças e Riqueza","livro_base":"A Psicologia Financeira","autor_base":"Morgan Housel","credito_sugerido_no_app":"Inspirado em A Psicologia Financeira — Morgan Housel"},
  {"id":432,"frase":"Riqueza cresce com margem, não com status.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":433,"frase":"Quem reduz confusão aproxima conversão.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Expert Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em Expert Secrets — Russell Brunson"},
  {"id":434,"frase":"Investir é aceitar o tempo como sócio.","categoria":"Finanças e Riqueza","livro_base":"Pai Rico, Pai Pobre","autor_base":"Robert T. Kiyosaki","credito_sugerido_no_app":"Inspirado em Pai Rico, Pai Pobre — Robert T. Kiyosaki"},
  {"id":435,"frase":"Clareza melhora quando a equipe entende o porquê.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":436,"frase":"Cultura melhora quando o problema é medido sem drama.","categoria":"Liderança e Estratégia","livro_base":"O Monge e o Executivo","autor_base":"James C. Hunter","credito_sugerido_no_app":"Inspirado em O Monge e o Executivo — James C. Hunter"},
  {"id":437,"frase":"Autoridade calma cresce quando a intenção fica limpa.","categoria":"Rapport, Networking e Comunicação","livro_base":"Inteligência Emocional","autor_base":"Daniel Goleman","credito_sugerido_no_app":"Inspirado em Inteligência Emocional — Daniel Goleman"},
  {"id":438,"frase":"Uma boa oferta remove ruído e aumenta valor percebido.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Expert Secrets","autor_base":"Russell Brunson","credito_sugerido_no_app":"Inspirado em Expert Secrets — Russell Brunson"},
  {"id":439,"frase":"Quem reduz ruído aproxima resposta.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":440,"frase":"Soltar desejo de posse abre espaço para compaixão.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":441,"frase":"Curiosidade cresce quando a revisão encontra o erro.","categoria":"Conhecimento e Aprendizado","livro_base":"Ultralearning","autor_base":"Scott H. Young","credito_sugerido_no_app":"Inspirado em Ultralearning — Scott H. Young"},
  {"id":442,"frase":"Menos promessa, mais primeiro bloco.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":443,"frase":"A paz não nasce do controle; nasce da lucidez.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":444,"frase":"Empatia cresce quando o respeito antecede o pedido.","categoria":"Rapport, Networking e Comunicação","livro_base":"Inteligência Emocional","autor_base":"Daniel Goleman","credito_sugerido_no_app":"Inspirado em Inteligência Emocional — Daniel Goleman"},
  {"id":445,"frase":"Soltar controle abre espaço para compaixão.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":446,"frase":"Uma boa oferta remove medo e aumenta confiança.","categoria":"Negócios, Vendas e Persuasão","livro_base":"As Armas da Persuasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em As Armas da Persuasão — Robert B. Cialdini"},
  {"id":447,"frase":"Riqueza cresce com consistência, não com decisão emocional.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":448,"frase":"Soltar drama abre espaço para sabedoria.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":449,"frase":"O olhar fica leve quando o controle perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":450,"frase":"O dia fica leve quando o desejo de posse perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":451,"frase":"Quem observa o excesso sem reagir encontra silêncio.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":452,"frase":"Clareza cresce quando a informação ganha contexto.","categoria":"Conhecimento e Aprendizado","livro_base":"Rápido e Devagar","autor_base":"Daniel Kahneman","credito_sugerido_no_app":"Inspirado em Rápido e Devagar — Daniel Kahneman"},
  {"id":453,"frase":"Venda melhor entendendo melhor.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Pré-Suasão","autor_base":"Robert B. Cialdini","credito_sugerido_no_app":"Inspirado em Pré-Suasão — Robert B. Cialdini"},
  {"id":454,"frase":"A dificuldade não pede drama; pede direção.","categoria":"Estoicismo e Resiliência","livro_base":"Cartas de um Estoico","autor_base":"Sêneca","credito_sugerido_no_app":"Inspirado em Cartas de um Estoico — Sêneca"},
  {"id":455,"frase":"A calma no topo organiza a base.","categoria":"Liderança e Estratégia","livro_base":"As Leis da Natureza Humana","autor_base":"Robert Greene","credito_sugerido_no_app":"Inspirado em As Leis da Natureza Humana — Robert Greene"},
  {"id":456,"frase":"Riqueza cresce com controle, não com pressa.","categoria":"Finanças e Riqueza","livro_base":"O Homem Mais Rico da Babilônia","autor_base":"George S. Clason","credito_sugerido_no_app":"Inspirado em O Homem Mais Rico da Babilônia — George S. Clason"},
  {"id":457,"frase":"O gesto fica leve quando o controle perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":458,"frase":"Rapport cresce quando o respeito antecede o pedido.","categoria":"Rapport, Networking e Comunicação","livro_base":"Comunicação Não-Violenta","autor_base":"Marshall B. Rosenberg","credito_sugerido_no_app":"Inspirado em Comunicação Não-Violenta — Marshall B. Rosenberg"},
  {"id":459,"frase":"A respiração fica mais clara quando a pressa perde o comando.","categoria":"Presença e Consciência","livro_base":"O Poder do Agora","autor_base":"Eckhart Tolle","credito_sugerido_no_app":"Inspirado em O Poder do Agora — Eckhart Tolle"},
  {"id":460,"frase":"Você não controla o vento, mas escolhe a postura.","categoria":"Estoicismo e Resiliência","livro_base":"O Obstáculo é o Caminho","autor_base":"Ryan Holiday","credito_sugerido_no_app":"Inspirado em O Obstáculo é o Caminho — Ryan Holiday"},
  {"id":461,"frase":"O instante fica leve quando o medo perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":462,"frase":"A atenção fica mais clara quando você para de fugir.","categoria":"Presença e Consciência","livro_base":"Tao Te Ching","autor_base":"Lao Tsé","credito_sugerido_no_app":"Inspirado em Tao Te Ching — Lao Tsé"},
  {"id":463,"frase":"A pessoa sente quando sua atenção está inteira.","categoria":"Rapport, Networking e Comunicação","livro_base":"Nunca Divida a Diferença","autor_base":"Chris Voss e Tahl Raz","credito_sugerido_no_app":"Inspirado em Nunca Divida a Diferença — Chris Voss e Tahl Raz"},
  {"id":464,"frase":"Menos distração, mais atenção.","categoria":"Presença e Consciência","livro_base":"O Profeta","autor_base":"Khalil Gibran","credito_sugerido_no_app":"Inspirado em O Profeta — Khalil Gibran"},
  {"id":465,"frase":"Quem reduz confusão aproxima decisão.","categoria":"Negócios, Vendas e Persuasão","livro_base":"Breakthrough Advertising","autor_base":"Eugene M. Schwartz","credito_sugerido_no_app":"Inspirado em Breakthrough Advertising — Eugene M. Schwartz"},
  {"id":466,"frase":"Conexão cresce quando a silêncio também participa.","categoria":"Rapport, Networking e Comunicação","livro_base":"Como Fazer Amigos e Influenciar Pessoas","autor_base":"Dale Carnegie","credito_sugerido_no_app":"Inspirado em Como Fazer Amigos e Influenciar Pessoas — Dale Carnegie"},
  {"id":467,"frase":"Não negocie com a bagunça; volte para a tarefa simples.","categoria":"Disciplina e Execução","livro_base":"Essencialismo","autor_base":"Greg McKeown","credito_sugerido_no_app":"Inspirado em Essencialismo — Greg McKeown"},
  {"id":468,"frase":"Criatividade melhora quando a mensagem encontra tensão.","categoria":"Criatividade, Conteúdo e Ideias","livro_base":"Criatividade S.A.","autor_base":"Ed Catmull e Amy Wallace","credito_sugerido_no_app":"Inspirado em Criatividade S.A. — Ed Catmull e Amy Wallace"},
  {"id":469,"frase":"Soltar impulso abre espaço para paz.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada","autor_base":"Tradição budista; ensinamentos atribuídos ao Buda","credito_sugerido_no_app":"Inspirado em Dhammapada — Tradição budista; ensinamentos atribuídos ao Buda"},
  {"id":470,"frase":"Quem observa o impulso sem reagir encontra silêncio.","categoria":"Sabedoria Budista e Desapego","livro_base":"Dhammapada / ensinamentos budistas","autor_base":"Tradição budista; ensinamentos atribuídos a Sidarta Gautama","credito_sugerido_no_app":"Inspirado em Dhammapada / ensinamentos budistas — Tradição budista; ensinamentos atribuídos a Sidarta Gautama"},
  {"id":471,"frase":"Não negocie com a procrastinação; volte para o primeiro bloco.","categoria":"Disciplina e Execução","livro_base":"Trabalho Focado","autor_base":"Cal Newport","credito_sugerido_no_app":"Inspirado em Trabalho Focado — Cal Newport"},
  {"id":472,"frase":"Menos distração, mais calma.","categoria":"Presença e Consciência","livro_base":"Sidarta","autor_base":"Hermann Hesse","credito_sugerido_no_app":"Inspirado em Sidarta — Hermann Hesse"},
  {"id":473,"frase":"Não negocie com a promessa vazia; volte para a tarefa simples.","categoria":"Disciplina e Execução","livro_base":"Hábitos Atômicos","autor_base":"James Clear","credito_sugerido_no_app":"Inspirado em Hábitos Atômicos — James Clear"},
  {"id":474,"frase":"Paciência cresce quando a pressão encontra método.","categoria":"Estoicismo e Resiliência","livro_base":"Manual de Epicteto","autor_base":"Epicteto","credito_sugerido_no_app":"Inspirado em Manual de Epicteto — Epicteto"},
  {"id":475,"frase":"Dinheiro sem tempo vira refém de medo.","categoria":"Finanças e Riqueza","livro_base":"O Caminho Mais Simples para a Riqueza","autor_base":"JL Collins","credito_sugerido_no_app":"Inspirado em O Caminho Mais Simples para a Riqueza — JL Collins"},
  {"id":476,"frase":"O gesto fica leve quando o apego perde força.","categoria":"Sabedoria Budista e Desapego","livro_base":"Mente Zen, Mente de Principiante","autor_base":"Shunryu Suzuki","credito_sugerido_no_app":"Inspirado em Mente Zen, Mente de Principiante — Shunryu Suzuki"},
  {"id":477,"frase":"Uma boa oferta remove medo e aumenta posicionamento.","categoria":"Negócios, Vendas e Persuasão","livro_base":"The Boron Letters","autor_base":"Gary C. Halbert","credito_sugerido_no_app":"Inspirado em The Boron Letters — Gary C. Halbert"},
  {"id":478,"frase":"Prática cresce quando o viés é observado.","categoria":"Conhecimento e Aprendizado","livro_base":"Como Ler Livros","autor_base":"Mortimer J. Adler e Charles Van Doren","credito_sugerido_no_app":"Inspirado em Como Ler Livros — Mortimer J. Adler e Charles Van Doren"}
];

function getLocalDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function LyriaDailyQuotePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Generates a YYYY-MM-DD string using local time
  const localDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }, []);

  // Deterministically selects a single quote for the day based on local date
  const dailyQuote = useMemo(() => {
    if (DAILY_QUOTES.length === 0) return null;
    let hash = 0;
    for (let i = 0; i < localDateStr.length; i++) {
      hash = localDateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % DAILY_QUOTES.length;
    return DAILY_QUOTES[index];
  }, [localDateStr]);

  // Initial check on mount
  useEffect(() => {
    const closedDate = localStorage.getItem("cp_daily_quote_popup_closed_date");
    const todayStr = getLocalDateKey();
    if (closedDate !== todayStr) {
      setIsOpen(true);
    }

    const unlockedDate = localStorage.getItem("lyria_quote_unlocked_date");
    if (unlockedDate === localDateStr) {
      setIsUnlocked(true);
    }
  }, [localDateStr]);

  const handleUnlock = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsUnlocked(true);
      setIsAnimating(false);
      localStorage.setItem("lyria_quote_unlocked_date", localDateStr);
      const user = getCurrentUser ? getCurrentUser() : null;
      if (user && supabase) {
        supabase
          .from('daily_quote_state')
          .upsert({ user_id: user.id, unlocked_date: localDateStr }, { onConflict: 'user_id' })
          .then(({ error }) => {
            if (error) {
              console.error('[Lyria Quote] Error saving quote state:', error.message);
            }
          })
          .catch(err => {
            console.error('[Lyria Quote] Exception saving quote state:', err);
          });
      }
    }, 1000); // 1-second transition
  };

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem("cp_daily_quote_popup_closed_date", getLocalDateKey());
    sessionStorage.setItem("lyria_quote_session_shown", "true");
  };

  if (!isOpen || !dailyQuote) return null;

  return (
    <div className="lyria-quote-backdrop" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <style>{`
        .lyria-quote-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 12, 18, 0.75);
          backdrop-filter: blur(14px);
          padding: var(--sp-4);
          animation: quoteFadeIn 0.3s ease forwards;
        }

        .lyria-quote-card {
          position: relative;
          width: 100%;
          max-width: 480px;
          background: linear-gradient(135deg, rgba(25, 30, 43, 0.85) 0%, rgba(15, 17, 23, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xl);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
          padding: var(--sp-8);
          text-align: center;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          animation: quoteScaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        html[data-mode="light"] .lyria-quote-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(244, 246, 248, 0.95) 100%);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.02);
        }

        .lyria-quote-close {
          position: absolute;
          top: var(--sp-4);
          right: var(--sp-4);
          background: transparent;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: var(--sp-2);
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .lyria-quote-close:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.06);
        }

        html[data-mode="light"] .lyria-quote-close:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .lyria-quote-ambient {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 30%, var(--accent-glow) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
          opacity: 0.8;
          transition: all 0.5s ease;
        }

        .lyria-quote-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .lyria-lock-wrapper {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--sp-6);
          position: relative;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
          color: var(--accent);
          transition: all 0.3s ease;
        }

        html[data-mode="light"] .lyria-lock-wrapper {
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.03);
        }

        .lyria-lock-wrapper.animating {
          animation: quotePulseGlow 1s ease-in-out infinite alternate;
          color: var(--text-primary);
        }

        .lyria-lock-sparkle {
          position: absolute;
          color: var(--accent);
          animation: floatSparkle 2s ease-in-out infinite;
        }

        .lyria-quote-title {
          font-size: var(--fs-xl);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: var(--sp-2);
          letter-spacing: -0.02em;
        }

        .lyria-quote-subtitle {
          font-size: var(--fs-base);
          color: var(--text-secondary);
          max-width: 320px;
          margin-bottom: var(--sp-8);
          line-height: 1.5;
        }

        .lyria-quote-badge {
          font-size: var(--fs-xs);
          font-weight: 700;
          color: var(--accent);
          background: var(--accent-subtle);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 6px 14px;
          border-radius: var(--radius-full);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: var(--sp-5);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          max-width: 90%;
        }

        .lyria-badge-sparkle {
          animation: badgeSparkleBreath 3s ease-in-out infinite;
        }

        @keyframes badgeSparkleBreath {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; }
          50% { transform: scale(1.2) rotate(15deg); opacity: 1; filter: drop-shadow(0 0 4px var(--accent-glow)); }
        }

        html[data-mode="light"] .lyria-quote-badge {
          border: 1px solid rgba(0, 0, 0, 0.03);
        }

        .lyria-quote-text {
          font-size: 1.35rem;
          font-weight: 600;
          line-height: 1.5;
          color: var(--text-primary);
          margin: var(--sp-4) 0 var(--sp-6);
          font-family: var(--font);
          letter-spacing: -0.01em;
          animation: quoteTextReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .lyria-quote-divider {
          width: 40px;
          height: 2px;
          background: var(--accent);
          opacity: 0.4;
          margin-bottom: var(--sp-5);
          border-radius: var(--radius-full);
        }

        .lyria-quote-credit {
          font-size: var(--fs-sm);
          color: var(--text-tertiary);
          line-height: 1.4;
          margin-bottom: var(--sp-8);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          max-width: 380px;
        }

        .lyria-btn-premium {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--sp-2);
          width: 100%;
          background: var(--accent);
          color: var(--text-inverse);
          font-weight: 600;
          font-size: var(--fs-base);
          padding: var(--sp-4) var(--sp-6);
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-base);
          box-shadow: 0 4px 15px var(--accent-glow);
        }

        .lyria-btn-premium:hover {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px var(--accent-glow);
        }

        .lyria-btn-premium:active {
          transform: translateY(0);
        }

        .lyria-btn-premium.ghost {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: none;
        }

        html[data-mode="light"] .lyria-btn-premium.ghost {
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .lyria-btn-premium.ghost:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.15);
        }

        html[data-mode="light"] .lyria-btn-premium.ghost:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        @keyframes quoteFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes quoteScaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes quotePulseGlow {
          from { box-shadow: 0 0 10px var(--accent-glow), inset 0 2px 4px rgba(0,0,0,0.2); border-color: var(--accent); }
          to { box-shadow: 0 0 25px var(--accent-glow), inset 0 2px 4px rgba(0,0,0,0.2); border-color: var(--accent-hover); }
        }

        @keyframes floatSparkle {
          0%, 100% { transform: translateY(0) scale(0.8); opacity: 0.3; }
          50% { transform: translateY(-8px) scale(1.2); opacity: 1; }
        }

        @keyframes quoteTextReveal {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="lyria-quote-card">
        <button className="lyria-quote-close" onClick={handleClose} aria-label="Fechar">
          <X size={18} />
        </button>

        <div className="lyria-quote-ambient" />

        <div className="lyria-quote-content">
          {!isUnlocked ? (
            <>
              <div className={`lyria-lock-wrapper ${isAnimating ? "animating" : ""}`}>
                <Lock size={28} style={{ transition: "all 0.3s" }} />
                {!isAnimating && (
                  <>
                    <Sparkles size={14} className="lyria-lock-sparkle" style={{ top: "-6px", right: "-6px", animationDelay: "0.2s" }} />
                    <Sparkles size={12} className="lyria-lock-sparkle" style={{ bottom: "-4px", left: "-6px", animationDelay: "0.8s" }} />
                  </>
                )}
              </div>
              <h2 className="lyria-quote-title">Revele a sua frase do dia</h2>
              <p className="lyria-quote-subtitle">
                {isAnimating 
                  ? "Sintonizando clareza mental..." 
                  : "Leia atentamente e guarde essa frase. A leitura transforma vidas."
                }
              </p>
              <button 
                className="lyria-btn-premium" 
                onClick={handleUnlock}
                disabled={isAnimating}
              >
                {isAnimating ? (
                  <span>Sintonizando...</span>
                ) : (
                  <>
                    <Unlock size={18} />
                    <span>Revelar Frase</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="lyria-quote-badge">
                <Sparkles size={12} className="lyria-badge-sparkle" />
                <span>{dailyQuote.categoria}</span>
              </div>
              
              <Quote size={24} style={{ color: "var(--accent)", opacity: 0.3, marginBottom: "var(--sp-2)" }} />
              
              <blockquote className="lyria-quote-text">
                “{dailyQuote.frase}”
              </blockquote>
              
              <div className="lyria-quote-divider" />
              
              <div className="lyria-quote-credit">
                <BookOpen size={14} style={{ minWidth: 14 }} />
                <span>
                  {dailyQuote.livro_base && dailyQuote.autor_base
                    ? `Inspirado no livro ${dailyQuote.livro_base} - ${dailyQuote.autor_base}`
                    : dailyQuote.credito_sugerido_no_app
                  }
                </span>
              </div>

              <button className="lyria-btn-premium ghost" onClick={handleClose}>
                Entrar no Lyria
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
