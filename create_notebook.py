import nbformat as nbf

nb = nbf.v4.new_notebook()

# Title and Overview
title_cell = nbf.v4.new_markdown_cell('''# CO2 Visualization Assignment (100 Points)

## Overview

In this assignment, you will create a visualization of CO2 concentration at sea level. The assignment is divided into three main parts:

1. Data Reading and Cleaning (30 points)
2. Base Map Drawing (30 points)
3. Data Visualization on Map (40 points)

### Grading Overview
- Each section has specific requirements that must be met for full points
- Partial credit will be given for partially correct implementations
- Code must be well-documented with comments explaining your approach
- Points will be deducted for inefficient or unclear code

### Important Notes
- Always run all code cells from the beginning when resuming work
- Each question has a designated answer area (code cell)
- Do not modify the provided code cells
- Add your code only in the marked areas
- Make sure to test your code before submission''')

# Import Libraries
import_md = nbf.v4.new_markdown_cell('''## Required Libraries

The following libraries are needed for this assignment. Run this cell first to import all necessary packages.''')

import_code = nbf.v4.new_code_cell('''from mpl_toolkits.basemap import Basemap
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
%matplotlib widget
from matplotlib.cm import ScalarMappable
import seaborn as sns
import matplotlib
from matplotlib.widgets import RangeSlider
from matplotlib.widgets import Button
import boto3
import json''')

# Part 1
part1_md = nbf.v4.new_markdown_cell('''## Part 1: Data Reading and Cleaning (30 Points)

### Overview
In this section, you will read and prepare the CO2 concentration data for visualization. The data is stored in CSV format and contains measurements from various locations.

### Grading Criteria (30 points total)
- Correct data loading (10 points)
  - Proper use of pandas to read CSV file
  - Correct handling of data types
- Data cleaning (10 points)
  - Removal of invalid entries
  - Handling of missing values
- Data validation (10 points)
  - Check data ranges
  - Verify coordinate values

### Requirements
1. Use pandas to read the CSV file
2. Handle missing or invalid data appropriately
3. Ensure coordinates are within valid ranges
4. Document your data cleaning steps with comments''')

data_path_code = nbf.v4.new_code_cell('''data_path = '/mnt/CO2/CO2data.csv' ''')

task1_1_md = nbf.v4.new_markdown_cell('''### Task 1.1: Read and Load Data (10 points)

Read the CO2 data from the CSV file using pandas. The file is located at the path specified in `data_path`.

Requirements:
- Use pandas.read_csv() function
- Handle any potential file reading errors
- Display the first few rows of the data to verify loading

Grading:
- Correct use of read_csv: 5 points
- Error handling: 3 points
- Data verification: 2 points''')

task1_1_code = nbf.v4.new_code_cell('''# YOUR CODE HERE
raise NotImplementedError()''')

# Part 2
part2_md = nbf.v4.new_markdown_cell('''## Part 2: Base Map Drawing (30 Points)

### Overview
In this section, you will create the base world map using the Basemap library. This will serve as the foundation for visualizing the CO2 data.

### Grading Criteria (30 points total)
- Map initialization (10 points)
  - Correct projection selection
  - Appropriate map boundaries
- Map features (10 points)
  - Coastlines
  - Country borders
  - Grid lines
- Map styling (10 points)
  - Clear and readable labels
  - Appropriate color scheme
  - Professional appearance

### Requirements
1. Use appropriate map projection for global data
2. Include necessary map features
3. Ensure map is clearly readable
4. Add appropriate labels and grid lines''')

task2_1_md = nbf.v4.new_markdown_cell('''### Task 2.1: Create Base Map (15 points)

Create a base map using Basemap with appropriate projection and boundaries.

Requirements:
- Use appropriate projection for global view
- Set correct map boundaries
- Add coastlines and country borders

Grading:
- Correct projection: 5 points
- Proper boundaries: 5 points
- Basic features: 5 points''')

task2_1_code = nbf.v4.new_code_cell('''# YOUR CODE HERE
raise NotImplementedError()''')

# Part 3
part3_md = nbf.v4.new_markdown_cell('''## Part 3: Data Visualization (40 Points)

### Overview
In this final section, you will visualize the CO2 concentration data on the world map using appropriate color coding and styling.

### Grading Criteria (40 points total)
- Data plotting (15 points)
  - Correct positioning of data points
  - Appropriate marker size and style
- Color scheme (15 points)
  - Meaningful color scale
  - Clear color bar
  - Readable labels
- Interactivity (10 points)
  - Working slider for time selection
  - Smooth updates

### Requirements
1. Plot data points at correct coordinates
2. Use color coding to represent CO2 concentration
3. Add a color bar with clear labels
4. Implement time-based data filtering''')

task3_1_md = nbf.v4.new_markdown_cell('''### Task 3.1: Plot Data Points (20 points)

Plot the CO2 concentration data on the map with appropriate color coding.

Requirements:
- Use scatter plot for data points
- Color code based on CO2 concentration
- Add color bar with clear labels

Grading:
- Correct plotting: 8 points
- Color coding: 7 points
- Color bar: 5 points''')

task3_1_code = nbf.v4.new_code_cell('''# YOUR CODE HERE
raise NotImplementedError()''')

# Add all cells to the notebook
nb.cells.extend([
    title_cell,
    import_md,
    import_code,
    part1_md,
    data_path_code,
    task1_1_md,
    task1_1_code,
    part2_md,
    task2_1_md,
    task2_1_code,
    part3_md,
    task3_1_md,
    task3_1_code
])

# Write the notebook to a file
with open('CO2_Visualization_Assignment.ipynb', 'w', encoding='utf-8') as f:
    nbf.write(nb, f) 