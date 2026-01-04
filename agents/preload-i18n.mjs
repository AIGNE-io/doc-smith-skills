export default async function preloadI18n(_, options) {
  const content = `
  ## 系统架构

  <!-- afs:image id="architecture-overview" key="snap-kit-architecture" desc="Snap Kit system architecture showing React frontend, Express API, and Crawler Engine components with their interactions" -->

  Snap Kit 采用清晰的三层架构设计:

  - **前端层**: React 19.1 + TypeScript + Vite,提供现代化的用户界面和实时仪表板
  - **API 层**: Express 4.21 + TypeScript,提供 RESTful 接口、DID 认证和速率限制
  - **引擎层**: Puppeteer + 队列系统 + SQLite,负责核心自动化和数据存储
    `;
  const _resultWriter = await this.afs.write("/modules/doc-smith/docs/getting-started-image.md", {
    content,
  });

  const image = await this.afs.getImageBySlot(
    "/modules/doc-smith/docs/getting-started-image.md",
    "architecture-overview",
    {
      view: {
        format: "jpg",
      },
      context: options.context,
    },
  );

  const result = await this.afs.read("/modules/doc-smith/docs/getting-started.md", {
    view: {
      language: "en",
    },
    context: options.context,
  });

  return {
    i18n: {
      result,
      image,
    },
  };
}

preloadI18n.afs = {
  modules: [
    {
      module: "local-fs",
      options: {
        name: "doc-smith",
        localPath: `${process.cwd()}/.aigne/doc-smith`,
        description: "The Doc Smith workspace for storing intermediate and output files",
      },
    },
  ],
  drivers: [
    {
      driver: "i18n",
      options: {
        defaultSourceLanguage: "zh",
      },
    },
    {
      driver: "image-generate",
      options: {},
    },
  ],
};
