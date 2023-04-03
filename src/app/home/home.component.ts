import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Firestore, collectionData, collection, addDoc, CollectionReference, DocumentData, updateDoc, doc, deleteDoc } from '@angular/fire/firestore';
import { getDoc } from '@firebase/firestore';
import { ConfirmationService, MessageService } from 'primeng/api';
import { BehaviorSubject, debounceTime, distinctUntilChanged, map, mergeMap, Observable, Subject, take, tap } from 'rxjs';

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
  visible = true;

  journalEntries$: Observable<JournalEntry[]>;

  activeJournalEntry: JournalEntry | undefined;
  journalContentUpdate$ = new Subject<string>();

  //   // Saving Date as string using JavaScript Date object
  // var dateString = new Date().toISOString();

  // // Parsing Date from string using JavaScript Date object
  // var date = new Date(Date.parse(dateString));

  constructor(private firestore: Firestore, private messageService: MessageService, private confirmationService: ConfirmationService) {
    this.journalEntries$ = this.activeJournalList$.pipe(
      tap(_ => this.activeJournalEntry = undefined),
      map(journalList => this.getFirestoreJournalCollection(journalList)),
      mergeMap(journalCollection => collectionData(journalCollection, { idField: 'id' })),
      tap((docArray) => {
        console.log('docArray', docArray);
      }),
      map((docArray) => {
        return (docArray as JournalEntry[])
          .filter(doc => {
            return doc.deleted === undefined || doc.deleted === false
          })
          .map((doc) => {
            const createdDateAsDate = new Date(Date.parse(doc.createdDate))
            return { ...doc, createdDateAsDate }
          })
          .sort((a, b) => {
            const dateA = a.createdDateAsDate;//new Date(Date.parse(a.createdDate));
            const dateB = b.createdDateAsDate;//new Date(Date.parse(b.createdDate));
            return dateB.getTime() - dateA.getTime();
          });
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
