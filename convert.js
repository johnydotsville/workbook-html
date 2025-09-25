const fs = require('fs');
const path = require('path');




async function buildFileTree(rootPath) {
  async function traverse(currentPath, inheritedTemplate = null, inheritedStyle = null) {
    const stats = await fs.promises.stat(currentPath);
    const name = path.basename(currentPath);
    
    const node = {
      name: name,
      path: currentPath,
      type: stats.isDirectory() ? 'directory' : 'file',
      relativePath: path.relative(rootPath, currentPath),
      template: inheritedTemplate,
      style: inheritedStyle
    };
    
    if (stats.isDirectory()) {
      const items = await fs.promises.readdir(currentPath);
      node.children = [];
      
      node.template = inheritedTemplate;
      if (items.includes('template.html')) {
        node.template = path.join(currentPath, 'template.html');
      } 

      node.style = inheritedStyle;
      if (items.includes('style.css')) {
        node.style = path.join(currentPath, 'style.css');
      }
      
      for (const item of items) {
        // Пропускаем сами файлы шаблонов, они уже учтены
        if (item === 'template.html' || item === 'style.css') continue;
        
        const itemPath = path.join(currentPath, item);
        const childNode = await traverse(itemPath, node.template, node.style);
        node.children.push(childNode);
      }
      
      node.children.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } else {
      node.extension = path.extname(name).toLowerCase();
      node.size = stats.size;
    }
    
    return node;
  }
  
  return await traverse(rootPath);
}




async function convertTree(tree, outputRoot) {
  async function processNode(node, currentOutputPath) {
    if (node.type === 'directory') {
      // Пропускаем корневую папку (сам tree)
      if (node !== tree) {
        const dirPath = path.join(currentOutputPath, node.name);
        await fs.promises.mkdir(dirPath, { recursive: true });
      }
      
      if (node.children) {
        for (const child of node.children) {
          // Для корневой папки передаем outputRoot, для остальных - текущий путь
          const nextPath = node === tree ? currentOutputPath : path.join(currentOutputPath, node.name);
          await processNode(child, nextPath);
        }
      }
    } else if (node.type === 'file' && node.extension === '.md') {
      const htmlFileName = node.name.replace('.md', '.html');
      const htmlFilePath = path.join(currentOutputPath, htmlFileName);
      const mdFilePath = node.path;
      
      await convertMdToHtml(mdFilePath, htmlFilePath, node.template, node.style);
    }
  }
  
  await fs.promises.mkdir(outputRoot, { recursive: true });
  await processNode(tree, outputRoot);
}




async function convertMdToHtml(mdFilePath, htmlFilePath, templateFilePath, styleFilePath) {
  const { spawn } = require('child_process');

  const pandoc = spawn('pandoc', [
    '-f', 'markdown', 
    '-t', 'html', 
    '--standalone', 
    '--template', templateFilePath,
    '-o', htmlFilePath
  ]);

  const inputStream = fs.createReadStream(mdFilePath);
  inputStream.pipe(pandoc.stdin);

  pandoc.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ ${mdFilePath} успешно сконвертирован`);
      try {
        const styleContent = fs.readFileSync(styleFilePath, 'utf8');
        let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        
        htmlContent = htmlContent.replace(
          /<style><\/style>/i, 
          `<style>${styleContent}</style>`
        );
        
        fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
      } catch (error) {
        console.error('Ошибка при обработке файлов:', error);
      }
    } else {
      console.log(`❌ Не удалось сконвертировать ${mdFilePath}`);
    }
  });

  pandoc.stderr.on('data', (data) => {
    console.error(`Ошибка: ${data}`);
  });
}




function insertToc(tocScriptStuff, targetFolder) {
  fs.cpSync(tocScriptStuff, targetFolder, { recursive: true });
}


function saveTree(tree, saveTo) {
  fs.writeFileSync(path.join(saveTo, 'notesTree.json'), JSON.stringify(tree, null, 2));
}




async function main() {
  try {
    const scriptDir = __dirname;
    const notesFolder = path.join(scriptDir, 'notes');
    const targetFolder = path.join(scriptDir, 'docs');

    const tree = await buildFileTree(notesFolder);
    // console.log(JSON.stringify(tree, null, 2));
    saveTree(tree, targetFolder);

    await convertTree(tree, targetFolder);

    const tocScriptStuff = path.join(scriptDir, 'toc');
    insertToc(tocScriptStuff, targetFolder);

  } catch (error) {
    console.error('Ошибка:', error);
  }
}




main();