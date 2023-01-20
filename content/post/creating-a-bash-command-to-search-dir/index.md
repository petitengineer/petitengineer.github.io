---
title: "Creating a Bash Command to Quickly Search Directories"
date: 2023-01-17T16:26:27-05:00
description: "An fzf based Bash alias for quickly jumping from directory to directory."
categories: ["Programming"]
draft: false
---

When working in the command line, you often want to navigate to a directory containing a particular file. You might not remember where that file is, but if you remember the file name, or part of its name, you can easily find it by using  [fzf – the open source fuzzy finder](https://github.com/junegunn/fzf "fzf's repository"). 

To obtain a list of all directories within the active folder, you can run

{{<highlight bash>}} find * -type d{{</highlight>}} 

where * is a wildcard and the -type parameter indicates what kind of file you are looking for (d is for directories). Find is typically installed by default on most Linux based OS. Find’s outputted list can then be searched by piping this list into fzf. By adding the cd command in front of all this, you can automatically jump to the file you’ve selected. Note that you may first need to install fzf using your package manager before you can make use of the following command. 

{{<highlight bash>}} cd find * -type d | fzf {{</highlight>}} 

To make an alias available for future use, append the following to your ~/.bashrc file. 

{{< highlight bash "linenos=inline" >}}
sd(){ #search directory.
    cd "$(find * -type d | fzf)";
}
shd(){ #search the home directory
    cd ~;
    cd "$(find * -type d | fzf)";
}
{{< /highlight >}}

Open a new bash instance to reload the .bashrc file or by typing {{<highlight bash>}} source ~/.bashrc {{</highlight>}} or by reloading bash using the {{<highlight bash>}} bash {{</highlight>}} command. Et voilà, you now have an easier way to navigate to your files.
