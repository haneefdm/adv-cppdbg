UNAME := $(shell uname -s)

ifeq ($(OS),Darwin)
CXX		  := clang++
CXX_FLAGS := -Wall -Wextra -std=c++17 -g
else
CXX		  := g++
CXX_FLAGS := -Wall -Wextra -std=c++17 -g
endif

BIN		:= bin
SRC		:= src
INCLUDE	:= include
LIB		:= lib

LIBRARIES	:=

ifeq ($(OS),Windows_NT)
EXECUTABLE	:= main.exe
else
EXECUTABLE	:= main
endif


all: $(BIN)/$(EXECUTABLE)

run: clean all
	./$(BIN)/$(EXECUTABLE)

$(BIN)/$(EXECUTABLE): $(SRC)/*.cpp
	$(CXX) $(CXX_FLAGS) -I$(INCLUDE) -L$(LIB) $^ -o $@ $(LIBRARIES)

clean:
	-rm -fr $(BIN)/*