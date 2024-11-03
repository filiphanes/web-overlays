<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  // import ImageTool from '@editorjs/image';
  import Paragraph from "@editorjs/paragraph";
  import Delimiter from "@editorjs/delimiter";
  import Code from "@editorjs/code";
  import SimpleImage from "@editorjs/simple-image";
  import RawTool from "@editorjs/raw";
  import { multiBrokerState } from "$lib/broker.svelte.js";
  import { HideTune } from "$lib/hidetune.js";

  const s = multiBrokerState({
    blocks: {},
    show: false,
  });
  $effect(()=>{s.blocks; editor?.render({blocks: s.blocks})});

  let editor = null;

  onMount(async () => {
    const EditorJS = await import('@editorjs/editorjs');           // @ts-ignore
    const Quote = (await import('@editorjs/quote')).default;       // @ts-ignore
    const List = (await import('@editorjs/list')).default;         // @ts-ignore
    const Table = (await import('@editorjs/table')).default;       // @ts-ignore
    const Header = (await import('@editorjs/header')).default;     // @ts-ignore
    const Embed  = (await import('@editorjs/embed')).default;      // @ts-ignore
    // const Checklist  = (await import('@editorjs/checklist')).default;      // @ts-ignore

    editor = new EditorJS.default({
      holder: 'editorjs',
      autofocus: true,
      tools: {
        header: {
          class: Header,
          inlineToolbar: true,
          config: {
            placeholder: "Nadpis",
            levels: [1, 2, 3, 4],
            defaultLevel: 2,
          },
        },
        image: SimpleImage,
        list: List,
        quote: Quote,
        paragraph: Paragraph,
        delimiter: Delimiter,
        code: Code,
        embed: Embed,
        table: Table,
        raw: RawTool,
        // checklist: Checklist,
        hide: HideTune,
      },
      tunes: ["hide"],
      autofocus: true,
    });

    s.connect({
      space: "editor",
      password: $page.url.hash.slice(1) || "demo",
      ...Object.fromEntries($page.url.searchParams),
    });
  });

  function save() {
    editor.save().then((data) => {
      s.blocks = data.blocks;
      console.log('blocks: ', data.blocks);
    }).catch((error) => {
      console.log('Saving failed: ', error)
    });
  }
</script>

<button onclick={save}>Uložiť</button>
<button onclick={()=>{s.show=!s.show}} class="btn" class:btn-success={!s.show} class:btn-danger={s.show}>{#if s.show}Skryť{:else}Zobraziť{/if}</button>
<div id="editorjs"></div>

<style>
  :global(.hideblock) {
    opacity: 0.3;
  }
  :global(body) {
    background: white;
    color: black;
    padding: 0.5rem;
  }
  button {
    color: whitesmoke;
    background-color: #555;
    font-size: 1rem;
    outline: none;
    margin: 0;
    line-height: 2rem;
    border: 1px solid black;
    border-radius: 0.5rem;
    user-select: none;
    padding: 0.3rem 0.7rem;
  }

  button:active {
    background-color: #ddd;
    color: black;
  }

  button:focus {
    border-color: #666;
  }
</style>
