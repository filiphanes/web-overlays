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

  let timestamp = 0;
  const s = multiBrokerState({
    blocks: {},
    show: true,
    timestamp: 1,
  });

  $effect(() => {
    s.blocks;
    if (editor && s.timestamp != timestamp) {
      editor.render({blocks: s.blocks});
      timestamp = s.timestamp;
    }
  });

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
      onChange: (api, event) => {
       save();
     },
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
      s.timestamp = data.timestamp;
      console.log('blocks: ', data.blocks);
    }).catch((error) => {
      console.log('Saving failed: ', error)
    });
  }
</script>

<button onclick={save}>Uložiť</button>
<div id="editorjs"></div>

<style>
  :root {
    /* background color */
    --main: #111827;
    /* Toolbar and popover */
    --primary: #0f172a;
    /* On hover or selected */
    --selected: rgba(255, 255, 255, 0.2);
    /* Border color */
    --border: #1e293b;
    /* Text and icon colors */
    --text: white;
  }
  :global(body) {
    background: black;
    color: white;
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
  
  :global(
  .ce-block--selected .ce-block__content,
  .ce-inline-toolbar,
  .codex-editor--narrow .ce-toolbox,
  .ce-conversion-toolbar,
  .ce-settings,
  .ce-settings__button,
  .ce-toolbar__settings-btn,
  .cdx-button,
  .ce-popover,
  .ce-toolbar__plus:hover) {
    background: #007991;
    color: inherit;
  }

  :global(
  .ce-inline-tool,
  .ce-conversion-toolbar__label,
  .ce-toolbox__button,
  .cdx-settings-button,
  .ce-toolbar__plus) {
    color: inherit;
  }

  :global(::selection) {
    /* background: #439a86; */
  }
  :global(
  .cdx-settings-button:hover,
  .ce-settings__button:hover,
  .ce-toolbox__button--active,
  .ce-toolbox__button:hover,
  .cdx-button:hover,
  .ce-inline-toolbar__dropdown:hover,
  .ce-inline-tool:hover,
  .ce-popover__item:hover,
  .ce-toolbar__settings-btn:hover) {
    background-color: #439a86;
    color: inherit;
  }

  :global(
  .cdx-notify--error) {
    background: #fb5d5d !important;
  }

  :global(
  .cdx-notify__cross::after,
  .cdx-notify__cross::before) {
    background: white;
  }
</style>
