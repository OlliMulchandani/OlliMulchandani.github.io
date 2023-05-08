---
layout: post
title: Playlist Generator
---


<html>
  <head>
    <title>Playlist Generator</title>
    <style>
      /* Set background color and font styles */
      body {
        background-color: #FAC898;
        font-family: Arial, sans-serif;
      }

      /* Center form and adjust spacing */
      form {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: 50px;
        color: #072A6C;
      }

      /* Style form inputs and buttons */
      input[type="text"] {
        width: 300px;
        padding: 10px;
        border-radius: 5px;
        border: none;
        margin-bottom: 20px;
      }

      input[type="submit"] {
        background-color: #072A6C;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        border: none;
        cursor: pointer;
        font-size: 20px;
      }

      input[type="submit"]:hover {
        background-color: #3e8e41;
      }

      /* Center header and set font size */
      h1 {
        text-align: center;
        font-size: 40px;
        color: #072A6C;
        margin-top: 50px;
      }
     
      button {
        background-color: #4CAF50;
        border: none;
        color: white;
        padding: 15px 32px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 10px;
      }
    </style>
  </head>
  <body>

    <form method="POST" action="/">
      <label for="auth_code">Authorization Code:</label>
      <input type="text" id="auth_code" name="auth_code"><br>
      <input type="submit" value="Generate Playlist">
      <button onclick="window.open('{{ auth_url }}', '_blank')">Open Auth URL</button>
    </form>
  </body>
</html>
