import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Firestore, collectionData, collection, addDoc, CollectionReference, DocumentData, updateDoc, doc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { ConfirmationService, MessageService } from 'primeng/api';
import { BehaviorSubject, debounceTime, distinctUntilChanged, map, mergeMap, Observable, Subject, take, tap, combineLatest } from 'rxjs';

interface JournalEntry {
  id: string,
  title: string,
  content: string,
  createdDate: string,
  createdDateAsDate: Date,
  updatedDate: string,
  deleted: boolean
};

interface JournalList {
  id: string,
  name: string,
  firebasePath: string
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      ['blockquote', 'code-block'],

      [{ 'header': 1 }, { 'header': 2 }],               // custom button values
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'script': 'sub' }, { 'script': 'super' }],      // superscript/subscript
      [{ 'indent': '-1' }, { 'indent': '+1' }],          // outdent/indent
      [{ 'direction': 'rtl' }],                         // text direction

      [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
      [{ 'font': [] }],
      [{ 'align': [] }],

      ['clean']                                         // remove formatting button
    ]
  }

  journalLists: JournalList[] = [
    {
      id: 'Chibs',
      name: 'Chibuzors Journal',
      firebasePath: 'journal-entries'
    },
    {
      id: 'Katherine',
      name: 'Katherines Journal',
      firebasePath: 'katherine-journal-entries'
    }
  ];

  activeJournalList$: BehaviorSubject<JournalList> = new BehaviorSubject(this.journalLists[0]);
  visible = true; // Default to visible (desktop behavior)
  isMobile = false;

  journalEntries$: Observable<JournalEntry[]>;
  searchTerm$: BehaviorSubject<string> = new BehaviorSubject('');
  sortOption$: BehaviorSubject<string> = new BehaviorSubject('newest');
  sortOption = 'newest';
  sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Oldest First', value: 'oldest' },
    { label: 'Alphabetical', value: 'alphabetical' }
  ];

  activeJournalEntry: JournalEntry | undefined;
  journalContentUpdate$ = new Subject<string>();
  entryCount = 0;
  isFullscreen = false;
  closeMenuOnSelection = true; // Default to true - close menu when selecting entries

  //   // Saving Date as string using JavaScript Date object
  // var dateString = new Date().toISOString();

  // // Parsing Date from string using JavaScript Date object
  // var date = new Date(Date.parse(dateString));

  constructor(private firestore: Firestore, private messageService: MessageService, private confirmationService: ConfirmationService) {
    // Check if mobile on init and set initial visibility
    this.checkIfMobile();
    window.addEventListener('resize', () => this.checkIfMobile());

    this.journalEntries$ = combineLatest([
      this.activeJournalList$.pipe(
        tap(_ => this.activeJournalEntry = undefined),
        map(journalList => this.getFirestoreJournalCollection(journalList)),
        mergeMap(journalCollection => collectionData(journalCollection, { idField: 'id' })),
        map((docArray) => {
          return (docArray as JournalEntry[])
            .filter(doc => {
              return doc.deleted === undefined || doc.deleted === false
            })
            .map((doc) => {
              const createdDateAsDate = new Date(Date.parse(doc.createdDate))
              return { ...doc, createdDateAsDate }
            });
        })
      ),
      this.searchTerm$.pipe(debounceTime(300)),
      this.sortOption$
    ]).pipe(
      map(([entries, searchTerm, sortOption]) => {
        // Filter by search term
        let filteredEntries = entries;
        if (searchTerm.trim()) {
          const lowerSearchTerm = searchTerm.toLowerCase();
          filteredEntries = entries.filter(entry =>
            (entry.title && entry.title.toLowerCase().includes(lowerSearchTerm)) ||
            (entry.content && entry.content.toLowerCase().includes(lowerSearchTerm))
          );
        }

        // Sort entries
        const sortedEntries = [...filteredEntries].sort((a, b) => {
          if (sortOption === 'newest') {
            return b.createdDateAsDate.getTime() - a.createdDateAsDate.getTime();
          } else if (sortOption === 'oldest') {
            return a.createdDateAsDate.getTime() - b.createdDateAsDate.getTime();
          } else { // alphabetical
            return a.title.localeCompare(b.title);
          }
        });

        // Update entry count
        this.entryCount = sortedEntries.length;
        return sortedEntries;
      })
    );

    this.journalContentUpdate$.pipe(
      debounceTime(2000),
      distinctUntilChanged())
      .subscribe(_value => {
        this.saveActiveEntry();
      });
  }

  setActiveEntry(entry: JournalEntry) {
    this.activeJournalEntry = entry;
    if (this.closeMenuOnSelection) {
      this.visible = false; // Close sidebar when entry is selected (if enabled)
    }
  }

  updateSearchTerm(searchTerm: string) {
    this.searchTerm$.next(searchTerm);
  }

  updateSortOption(sortOption: string) {
    this.sortOption = sortOption;
    this.sortOption$.next(sortOption);
  }

  checkIfMobile() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 768;
    
    // Set default visibility based on screen size
    if (!wasMobile && this.isMobile) {
      // Switching from desktop to mobile - hide sidebar
      this.visible = false;
    } else if (wasMobile && !this.isMobile) {
      // Switching from mobile to desktop - show sidebar
      this.visible = true;
    }
  }

  openFullscreenEditor() {
    if (this.activeJournalEntry) {
      this.isFullscreen = true;
    }
  }

  createNewActiveEntry() {
    this.activeJournalEntry = { title: `${new Date().toDateString()} - `, content: '', createdDate: new Date().toISOString(), createdDateAsDate: new Date(), deleted: false } as JournalEntry;
  }

  saveActiveEntry() {
    this.activeJournalList$.pipe(
      take(1),
      tap(currentActiveJournal => {
        if (this.activeJournalEntry) {
          const journalCollection = this.getFirestoreJournalCollection(currentActiveJournal);
          const createdDate = this.activeJournalEntry.createdDateAsDate ? this.activeJournalEntry.createdDateAsDate.toISOString() : new Date().toISOString();


          if (this.activeJournalEntry.id === undefined) {
            addDoc(journalCollection, { ...this.activeJournalEntry, createdDate }).then(result => {
              this.messageService.add({
                severity: 'success',
                summary: 'Journal Entry Added Successfully',
                detail: `Add of ${this.activeJournalEntry?.title} Successful`
              });

              // After creating a new document, load it
              getDoc(result).then(newDoc => {
                const doc = { id: newDoc.id, ...newDoc.data() } as JournalEntry;
                const createdDateAsDate = new Date(Date.parse(doc.createdDate))
                this.activeJournalEntry = { ...doc, createdDateAsDate };
              });
            });
          } else {
            const docRef = doc(this.firestore, currentActiveJournal.firebasePath, this.activeJournalEntry.id);


            updateDoc(docRef, { ...this.activeJournalEntry, createdDate, updatedDate: new Date().toISOString() })
              .then(_result => {
                this.messageService.add({
                  severity: 'success',
                  summary: 'Update Occurred Successfully',
                  detail: `Update of ${this.activeJournalEntry?.title} Successful`
                });
              })
              .catch(error => {
                console.log(error);
              });
          }
        }

      })
    ).subscribe();
  }

  deleteJournalEntry(event: Event, entry: JournalEntry) {
    this.confirmationService.confirm({
      target: event.target || undefined,
      message: `Are you sure that you want to delete this journal entry ${entry?.title}`,
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.activeJournalList$.pipe(
          take(1),
          tap(currentActiveJournal => {
            if (entry) {
              const entryName = entry.title;
              const createdDate = entry.createdDateAsDate ? entry.createdDateAsDate.toISOString() : new Date().toISOString();

              const docRef = doc(this.firestore, currentActiveJournal.firebasePath, entry.id);

              updateDoc(docRef, { ...entry, createdDate, updatedDate: new Date().toISOString(), deleted: true })
                .then(_result => {
                  this.messageService.add({
                    severity: 'success',
                    summary: 'Delete Occurred Successfully',
                    detail: `Delete of ${entryName} Successful`
                  });

                  if (this.activeJournalEntry?.id === entry.id) {
                    this.activeJournalEntry = undefined;
                  }
                })
                .catch(error => {
                  console.log(error);
                });
            }

          })
        ).subscribe();
      },
      reject: () => {
        this.messageService.add({ severity: 'error', summary: 'Delete Cancelled', detail: 'Delete cancelled' });
      }
    });


    // True Delete 
    // this.activeJournalList$.pipe(
    //   take(1),
    //   tap(currentActiveJournal => {
    //     if (entry) {
    //       const docRef = doc(this.firestore, currentActiveJournal.firebasePath, entry.id);

    //       deleteDoc(docRef);
    //     }
    //   })
    // ).subscribe();
  }

  getFirestoreJournalCollection(newActiveJournalList: JournalList): CollectionReference<DocumentData> {
    const journalListToUse: JournalList = newActiveJournalList;

    // console.log('The journalListToUse is', journalListToUse);

    const journalCollection = collection(this.firestore, journalListToUse.firebasePath);
    return journalCollection;
  }
}
