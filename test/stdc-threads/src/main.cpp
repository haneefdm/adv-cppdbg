// CPP program to demonstrate multithreading 
// using three different callables. 
#include <iostream> 
#include <thread> 
using namespace std; 

int global = 10 ;
static int stglobal = 20 ;

static int buf[1024] ;
void *bufptr = buf ;

// A dummy function 
void foo(int Z) 
{ 
	for (int i = 0; i < Z; i++) { 
		cout << "Thread using function"
			" pointer as callable " << global << "\n"; 
			global++ ;
	} 
} 

// A callable object 
class thread_obj { 
public: 
	void operator()(int x) 
	{ 
		for (int i = 0; i < x; i++)  {
			cout << "Thread using function"
				" object as callable " << stglobal << "\n"; 
			stglobal++ ;
		}
	} 
}; 

int main() 
{ 
	volatile int local = 3 ;
	cout << "Threads 1 and 2 and 3 "
		"operating independently" << endl; 

	// This thread is launched by using 
	// function pointer as callable 
	thread th1(foo, 3);

	// This thread is launched by using 
	// function object as callable 
	thread th2(thread_obj(), 3); 

	// Define a Lambda Expression 
	auto f = [](int x) { 
		for (int i = 0; i < x; i++)  {
			cout << "Thread using lambda"
			" expression as callable " << i << "\n"; 
		}
	}; 

	// This thread is launched by using 
	// lamda expression as callable 
	thread th3(f, local); 

	// Wait for the threads to finish 
	// Wait for thread t1 to finish 
	th1.join(); 

	// Wait for thread t2 to finish 
	th2.join(); 

	// Wait for thread t3 to finish 
	th3.join(); 

	return 0; 
} 
