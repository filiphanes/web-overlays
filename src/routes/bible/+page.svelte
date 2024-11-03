<svelte:head>
	<title>Biblia ovládač</title>
</svelte:head>
<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import NumberPad from "$lib/NumberPad.svelte";
  import { multiBrokerState } from '$lib/broker.svelte.js';
  import {index as roh} from "./roh.json.js"
  import {index as seb} from "./seb.json.js"
  import {index as sep} from "./sep.json.js"
  import {index as ssv} from "./ssv.json.js"
  import {index as bot} from "./bot.json.js"
  import {index as csp} from "./csp.json.js"
  import {index as kjv} from "./kjv.json.js"

  const bibles = $state({roh, seb, sep, ssv, bot, csp, kjv});
  /* Set index for each book */
  for (const [id, bible] of Object.entries(bibles)) {
    bible.books = {};
    let i = 0;
    for (const book of bible.bookslist) {
      book.index = i++;
      bible.books[book.abbreviation] = book;
    }
  }

  let defaultAddress = { bible: "roh", book: "gn", chapter: 1, verse: 1, vcount: 1 };
  let bookFilter = $state("");
  let history = $state([defaultAddress]);

  /* Synced State */
  const s = multiBrokerState({
    show: false,
    line1: '',
    line2: '',
    line3: '',
    line4: '',
    bible: 'roh',
    book: 'gn',
    chapter: 1,
    verse: 1,
    vcount: 1,
    bible2: '',
    theme: '',
    history: [defaultAddress],
    program: {},
    verseNumbers: false,
    showNextVerses: true,
    hideOnSelector: true,
    splitButton: false,
    allinone: "{}",
  })
  
  $effect(()=>{s.line1 = addressAsString(address)});
  $effect(()=>{s.line2 = addressContent(address, s.verseNumbers)});
  $effect(()=>{address2; s.line3 = addressAsString(address2)});
  $effect(()=>{address2; s.line4 = addressContent(address2, s.verseNumbers)});
  $effect(()=>{s.allinone = JSON.stringify({line1:s.line1, line2:s.line2, line3:s.line3, line4:s.line4, show:s.show})});

  /* Derived variables */
  let address = $derived({bible: s.bible, book: s.book, chapter: s.chapter, verse: s.verse, vcount: s.vcount});
  let address2 = $derived({bible: s.bible2, book: s.book, chapter: s.chapter, verse: s.verse, vcount: s.vcount});
  let books1 = $derived(bibles[s.bible].books);
  let bookLength = $derived(Object.keys(bibles[s.bible].books[s.book].chapters||{}).length);
  let chapterLength = $derived(((bibles[s.bible].books[s.book].chapters||{})[s.chapter]||[]).length);
  let addressNext = $derived(nextVerse({...address}));
  let address2Next = $derived(nextVerse({...address2}));
  let line2Next = $derived(addressContent(addressNext, s.verseNumbers));
  let line4Next = $derived(addressContent(address2Next, s.verseNumbers));
  let bookList = $derived(bibles[s.bible].bookslist);
  let filteredBooks = $derived(bookFilter ? bookList.filter(matchesBook) : bookList);

	onMount(() => {
    s.mount({
			gun: 'https://gun.filiphanes.sk/gun',
      space: 'bible',
      password: $page.url.hash.slice(1) || 'demo',
      ...Object.fromEntries($page.url.searchParams)
    });
  })


  async function fetchChapters(bibleid, abbreviation) {
    // console.log('fetchChapters(', bibleid, abbreviation);
    if (!bibleid) return;
    let chapters = bibles[bibleid].books[abbreviation]?.chapters;
    if (chapters) {
      return chapters;
    } else {
      const res = await fetch(`/bible/${bibleid}/${abbreviation}.json`);
      chapters = await res.json();
    }
    return chapters;
  }

  function matchesBook(book) {
    const prefix = bookFilter.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const bookLower = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (
      bookLower.startsWith(prefix) ||
      book.abbreviation.startsWith(prefix) ||
      (book.aliases && book.aliases.some(a => a.toLowerCase().startsWith(prefix))) ||
      (prefix.length >= 2 && bookLower.includes(' ' + prefix))
    );
  }

  function addToHistory(a) {
    history.unshift({
      book: a.book,
      chapter: a.chapter,
      verse: a.verse,
      vcount: a.vcount,
    });
    /* remove earlier duplicates */
    history = history.filter((h, i) => i === 0 || !equalAddresses(h, a));
  }

  function addressAsString(a) {
    if (a === undefined || !a.bible) return '';
    const books = bibles[a.bible].books;
    if (!books[a.book]) return '';
    var s = books[a.book].name + ' ' + a.chapter;
    if (a.verse) {
      s += ',' + a.verse;
      if (a.vcount > 1) {
        s += '-' + (a.verse + a.vcount - 1);
      }
    }
    return s;
  }

  function addressContent(a, numbers) {
    if (a === undefined || !a?.bible) return '';
    const book = bibles[a.bible].books[a.book];
    let content = '';
    // console.log('addressContent', a, books);
    if (book) {
      if (!book.chapters) {
        return content;
      }
      if (a.verse && book.chapters[a.chapter]) {
        for (var i = a.verse; i < a.verse + a.vcount; i++) {
          content += `\n`;
          if (numbers) {
            content += `<sup>${i}</sup>`;
          }
          content += book.chapters[a.chapter][i - 1] || '';
        }
      }
    }
    return content;
  };

  function equalAddresses(a, b) {
    return b !== undefined &&
      a.book == b.book &&
      a.chapter == b.chapter &&
      a.verse == b.verse &&
      a.vcount == b.vcount;
  }

  function addressSelector(a) {
    return function () {
      if (s.hideOnSelector) s.show = false;
      fetchChapters(s.bible, a.book).then((chapters) => {
        bibles[s.bible].books[a.book].chapters = chapters;
        s.book = a.book;
        s.chapter = a.chapter || '';
        s.verse = a.verse || '';
        s.vcount = a.vcount || 1;
      });
      if (address2.bible && s.bible != address2.bible && !bibles[address2.bible].books[a.book].chapters) {
        fetchChapters(address2.bible, a.book).then((chapters) => {
          bibles[address2.bible].books[a.book].chapters = chapters;
        });
      }
    };
  }

  function removeHistory(j) {
    return function () {
      history = history.filter((h, i) => (i !== j));
    }
  }

  function toggleShown() {
    s.show = !s.show;
    if (s.show) {
      addToHistory(address);
    }
  }

  function sendToProgram() {
  }

  function prevVerse(a) {
    a.verse = +a.verse - a.vcount;
    if (a.verse <= 0) {
      a = prevChapter(a);
      a.verse = books1[a.book].chapters[a.chapter]?.length || 1;
    }
    return a;
  };

  function nextVerse(a) {
    a.verse = +a.verse + a.vcount;
    if (a.verse > chapterLength) {
      a = nextChapter(a);
    }
    return a;
  };

  function prevChapter(a) {
    a.chapter = +a.chapter - 1;
    if (a.chapter <= 0) {
      a = prevBook(a);
      a.chapter = Object.keys(books1[a.book].chapters||{}).length;
    }
    return a;
  };

  function nextChapter(a) {
    a.chapter = +a.chapter + 1;
    if (a.chapter > bookLength) {
      a.chapter = 1;
      a = nextBook(a);
    }
    a.verse = 1;
    return a;
  };

  function prevBook(a) {
    const books = bibles[s.bible].bookslist;
    const newIndex = books1[a.book].index - 1 + books.length;
    a.book = books[newIndex%books.length].abbreviation;
    console.log('newIndex', newIndex, s.book);
    return a;
  };

  function nextBook(a) {
    const books = bibles[s.bible].bookslist;
    const newIndex = books1[a.book].index + 1;
    a.book = books[newIndex%books.length].abbreviation;
    return a;
  };
  
  function gotoPrevVerse() {
    s.verse = Math.max(1, s.verse-s.vcount);
    // if (program.line1) sendToProgram;
  }
  
  function gotoNextVerse() {
    const a = nextVerse({...address});
    s.book = a.book;
    s.chapter = a.chapter;
    s.verse = a.verse;
    // s.verse = Math.min(s.verse+s.vcount, chapterLength);
    // if (program.line1) sendToProgram;
  }
  function changeBible1(event) {
    const newbible = event.target.value;
    fetchChapters(newbible, s.book).then((chapters) => {
      bibles[newbible].books[s.book].chapters = chapters;
      s.bible = newbible;
    });
  }
  function changeBible2(event) {
    const newbible = event.target.value;
    if (!newbible) {
      s.bible2 = newbible;
      return;
    }
    fetchChapters(newbible, s.book).then((chapters) => {
      bibles[newbible].books[s.book].chapters = chapters;
      s.bible2 = newbible;
    })
  }
</script>

<div class="input-group" style="width: 100%; display: flex;">
  <input class="form-control" type="text" placeholder="filter" bind:value={bookFilter} style="flex-grow:1;" />
  <button type="button" class="form-control btn btn-secondary" onclick={()=>{bookFilter=''}} style="max-width: 2rem;">×</button>
</div>
<div class="books-filter">
  {#each filteredBooks as b}
  <button class="book-item btn" class:btn-primary={b.abbreviation==s.book} onclick={addressSelector({book: b.abbreviation})}>{b.name}</button>
  {/each}
</div>
<div class="address-filter">
  {#each history as addr, i}
  <div class="address-item btn-group">
    <button class="address-set btn" class:btn-primary={equalAddresses(addr, address)} onclick={addressSelector(addr)}>{addressAsString({bible: s.bible, ...addr}) || (addr.book+' '+addr.chapter+','+addr.verse)}</button>
    <button class="btn btn-secondary address-remove" onclick={removeHistory(i)}>×</button>
  </div>
  {/each}
</div>

<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Kapitola: {s.chapter} z {bookLength}
  <NumberPad bind:value={s.chapter} max={bookLength} />
  <button class="btn btn-primary" onclick={()=>{s.chapter=Math.max(1,s.chapter-1)}} style="line-height: 2rem;"
  >⇦</button><button class="btn btn-primary" onclick={()=>{s.chapter=Math.min(s.chapter+1,bookLength)}} style="line-height: 2rem;"
  >⇨</button><br/>
  {#if s.splitButton}
    <button class="control-button btn btn-success" style="line-height: 2rem;"
      onclick={()=>{ s.program = {line1: s.line1, line2: s.line2, line3: s.line3, line4: s.line4} }}>Zobraziť</button>
    <button class="btn btn-danger" style="line-height: 2rem;"
      onclick={()=>{ s.program = {} }}>&times;</button>
  {:else}
    <button style="line-height: 2rem;" onclick={toggleShown} class="btn control-button" class:btn-danger={s.show} class:btn-success={!s.show}
    >{#if s.show}Skryť{:else}Zobraziť{/if}</button>
  {/if}
</div>
<div style="display: inline-block; margin: .5rem; vertical-align: top;">
  Verš: {s.verse} {#if s.vcount>1} - {s.verse + s.vcount - 1}{/if} z {chapterLength}
  <NumberPad bind:value={s.verse} max={chapterLength} />
  <button class="btn btn-primary" style="line-height: 2rem;" onclick={gotoPrevVerse} disabled={s.verse<=1}
  >⇦</button><button class="btn btn-primary" style="line-height: 2rem;" onclick={gotoNextVerse} disabled={s.verse+s.vcount>chapterLength}
  >⇨</button><br/><button disabled style="background: transparent;" aria-label="empty"
  ></button><button class="btn btn-primary" onclick={()=>{s.vcount -= 1}} style="line-height: 2rem;" disabled={s.vcount<=1}
  >-1</button><button class="btn btn-primary" onclick={()=>{s.vcount += 1}} style="line-height: 2rem;" disabled={s.vcount>chapterLength}
  >+1</button><br/><button disabled style="background: transparent;" aria-label="empty"
  ></button>
</div>

<div class="preview">
  {s.line1}<br/>
  {@html s.line2}
</div>
{#if s.showNextVerses}
<div class="preview next">
  {@html line2Next}
</div>
{/if}

{#if address2.bible}
<div class="preview">
  {s.line3}<br/>
  {@html s.line4}
</div>
{#if s.showNextVerses}
<div class="preview next">
  {@html line4Next}
</div>
{/if}
{/if}

<br />
<div class="settings">
  <div class="bible">
    Preklad:
    <select value={s.bible} onchange={changeBible1}>
    {#each Object.entries(bibles) as [id, bible]}
      <option value={id}>{bible.name}</option>
    {/each}
    </select>
  </div>

  <div class="bible">
    Preklad 2:
    <select value={address2.bible} onchange={changeBible2}>
      <option value="">Žiadny</option>
    {#each Object.entries(bibles) as [id, bible]}
      <option value={id}>{bible.name}</option>
    {/each}
    </select>
  </div>

  <div class="theme">
    Téma:
    <select bind:value={s.theme}>
      <option value="" selected>Predvolená</option>
      <option value="simple-with-shadow" selected>Jednoduché s tieňom</option>
      <option value="fullscreen-white-bg">Fullscreen biele pozadie</option>
    </select>
  </div>

  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={s.verseNumbers} /> Čísla veršov
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={s.showNextVerses} /> Nasledujúce verše
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={s.hideOnSelector} /> Skryť pri výbere knihy
    </label>
  </div>
  <div class="bible">
    <label>
      <input type="checkbox" bind:checked={s.splitButton} /> Texty do programu až po kliknutí
    </label>
  </div>

</div>

<style>
input,
button,
select {
  font-family: inherit;
  font-size: inherit;
  padding: 0.4em;
  margin: 0 0 0.25em 0;
  box-sizing: border-box;
  border: none;
  background: #555;
  color: whitesmoke;
  border-radius: .5rem;
}

input:disabled {
  color: #ccc;
}

button {
  color: whitesmoke;
  background-color: #555;
  font-size: 1rem;
  outline: none;
  margin: 0;
  line-height: 2rem;
  width: 3rem;
  border: 1px solid black;
  border-radius: .5rem;
  user-select: none
}

button:active {
  background-color: #ddd;
  color: black;
}

button:focus {
  border-color: #666;
}

.control-button {
  width: 6rem;
  /* float: right; */
}

.books-filter,
.address-filter {
  display: block;
  width: 49%;
  margin: 0 1% 1rem 0;
  padding: 0;
  height: 10rem;
  overflow: scroll;
  float: left;
  max-width: 15rem;
}

.book-item,
.address-set,
.address-remove {
  width: 100%;
  margin: 0 0 .1rem;
  padding: .3rem;
  text-align: left;
  color: whitesmoke;
  border-radius: 0;
  background: black;
}

.address-item {
  width: 100%;
  padding: 0;
  margin: 0;
  max-width: 30rem;
  display: flex;
}

.address-set {
  width: auto;
  padding: .5rem;
  margin: 0;
  text-align: left;
  flex-grow: 2;
}

.address-remove {
  margin: 0;
  max-width: 2rem;
  padding: .25rem .5rem;
  line-height: 1rem;
}

.preview {
  padding: .5rem;
  user-select: text;
}
.preview.next {
  color: #777;
}

.btn-success {
  background-color: green;
}

.btn-danger {
  background-color: red;
}

.settings {
  padding: .5rem;
}
</style>