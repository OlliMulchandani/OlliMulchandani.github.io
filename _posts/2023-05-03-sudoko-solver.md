---
layout: post
title:  "Sudoko Solver"
date:   2023-05-03 17:46:07 -0400
categories: jekyll update
---
This is a program that takes a Sudoku board game state as an 81 character string, with blank spaces represented as 0s, and returns a solved 81 character string.


{% highlight python %}
def solve(board_str):
    
    #turns string into 2d array
    board = []
    for i in range(9):
        row = []
        for j in range(9):
            index = i*9 + j
            char = board_str[index]
            if char == '0':
                row.append(0)
            else:
                row.append(int(char))
        board.append(row)

    #calls recursive helper method
    helper(board, 0, 0)
    
    #puts 2d array back into string to return
    result = ""
    for i in range(9):
        for j in range(9):
            result += str(board[i][j])
            
    return result


def helper(board, row, col):
    
    if col == 9: #if in last column, go to next row
        row += 1
        col = 0
        if row == 9: #at the end of the board, base case
            return True
           
    #if there's already a digit in the spot, iterate to the next column
    if board[row][col] != 0:
        return helper(board, row, col+1)
        
        
    for num in range(1, 10):
        if is_valid(board, row, col, num):
            board[row][col] = num
            
            #recursively call function with next box
            if helper(board, row, col+1):
                return True
    board[row][col] = 0
    return False

def is_valid(board, row, col, num):
    for i in range(9):  
        #checking to see if num exists in row or column
        if board[row][i] == num or board[i][col] == num: 
            return False
        
        #if num exists in 3x3 box, checking with integer division and modulus operator
        if board[3*(row//3) + i//3][3*(col//3) + i%3] == num: 
            return False
        
    return True


print(solve("003020600900305001001806400008102900700000008006708200002609500800203009005010300"))

{% endhighlight %}

This program takes the 81 digit string "003020600900305001001806400008102900700000008006708200002609500800203009005010300", which can be represented in a more readable format here:

| 0 | 0 | 3 | 0 | 2 | 0 | 6 | 0 | 0 |
|---|---|---|---|---|---|---|---|---|
| 9 | 0 | 0 | 3 | 0 | 5 | 0 | 0 | 1 |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 1 | 8 | 0 | 6 | 4 | 0 | 0 |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 8 | 1 | 0 | 2 | 9 | 0 | 0 |
|---|---|---|---|---|---|---|---|---|
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 6 | 7 | 0 | 8 | 2 | 0 | 0 |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 2 | 6 | 0 | 9 | 5 | 0 | 0 |
|---|---|---|---|---|---|---|---|---|
| 8 | 0 | 0 | 2 | 0 | 3 | 0 | 0 | 9 |
|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 5 | 0 | 1 | 0 | 3 | 0 | 0 |

It then outputs the solved Sudoko board as another 81 character string: "483921657967345821251876493548132976729564138136798245372689514814253769695417382", which can also be represented in a more friendly manner here:

| 4 | 8 | 3 | 9 | 2 | 1 | 6 | 5 | 7 |
---|---|---|---|---|---|---|---|---|
| 9 | 6 | 7 | 3 | 4 | 5 | 8 | 2 | 1 |
---|---|---|---|---|---|---|---|---|
| 2 | 5 | 1 | 8 | 7 | 6 | 4 | 9 | 3 |
---|---|---|---|---|---|---|---|---|
| 5 | 4 | 8 | 1 | 3 | 2 | 9 | 7 | 6 |
---|---|---|---|---|---|---|---|---|
| 7 | 2 | 9 | 5 | 6 | 4 | 1 | 3 | 8 |
---|---|---|---|---|---|---|---|---|
| 1 | 3 | 6 | 7 | 9 | 8 | 2 | 4 | 5 |
---|---|---|---|---|---|---|---|---|
| 3 | 7 | 2 | 6 | 8 | 9 | 5 | 1 | 4 |
---|---|---|---|---|---|---|---|---|
| 8 | 1 | 4 | 2 | 5 | 3 | 7 | 6 | 9 |
---|---|---|---|---|---|---|---|---|
| 6 | 9 | 5 | 4 | 1 | 7 | 3 | 8 | 2 |




